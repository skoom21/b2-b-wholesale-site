import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const supabase = await createServerSupabaseClient()

    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    // Orders with store type, for revenue trend + revenue-by-type
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount, status, order_date, store_id, stores(store_type)')
      .eq('brand_id', admin.brand_id)
      .gte('order_date', sixMonthsAgo.toISOString())

    if (ordersError) {
      return apiError('Failed to fetch orders for report', 'DATABASE_ERROR', 500, ordersError)
    }

    const revenueOrders = (orders || []).filter(o => o.status !== 'cancelled')

    // Build last 6 months buckets (oldest -> newest)
    const monthBuckets: { key: string; label: string; date: Date }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthBuckets.push({ key: monthKey(d), label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, date: d })
    }

    const monthlyRevenue = monthBuckets.map(bucket => {
      const total = revenueOrders
        .filter(o => monthKey(new Date(o.order_date)) === bucket.key)
        .reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0)
      return { month: bucket.label, revenue: Math.round(total * 100) / 100 }
    })

    // Revenue by store type, current month
    const currentMonthKey = monthKey(now)
    const revenueByType: Record<string, number> = { grocery_store: 0, restaurant: 0, distributor: 0, other: 0 }
    revenueOrders
      .filter(o => monthKey(new Date(o.order_date)) === currentMonthKey)
      .forEach(o => {
        const type = (o as any).stores?.store_type || 'other'
        revenueByType[type] = (revenueByType[type] || 0) + parseFloat(o.total_amount?.toString() || '0')
      })

    // Order items joined with parent order date/status, for product
    // analytics — order_items has no brand_id of its own, so it's scoped
    // transitively through the (inner-joined) parent order's brand_id.
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, product_name, product_sku, quantity, subtotal, orders!inner(order_date, status, brand_id)')
      .eq('orders.brand_id', admin.brand_id)
      .gte('orders.order_date', sixMonthsAgo.toISOString())

    if (itemsError) {
      return apiError('Failed to fetch order items for report', 'DATABASE_ERROR', 500, itemsError)
    }

    const validItems = (items || []).filter((i: any) => i.orders?.status !== 'cancelled')

    const thisMonthItems = validItems.filter((i: any) => monthKey(new Date(i.orders.order_date)) === currentMonthKey)
    const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const lastMonthItems = validItems.filter((i: any) => monthKey(new Date(i.orders.order_date)) === lastMonthKey)

    function aggregateByProduct(rows: any[]) {
      const map = new Map<string, { product_id: string; name: string; sku: string; quantity: number; revenue: number }>()
      for (const row of rows) {
        const key = row.product_id
        const existing = map.get(key)
        const qty = row.quantity || 0
        const rev = parseFloat(row.subtotal?.toString() || '0')
        if (existing) {
          existing.quantity += qty
          existing.revenue += rev
        } else {
          map.set(key, { product_id: row.product_id, name: row.product_name, sku: row.product_sku, quantity: qty, revenue: rev })
        }
      }
      return Array.from(map.values())
    }

    const thisMonthAgg = aggregateByProduct(thisMonthItems).sort((a, b) => b.quantity - a.quantity)
    const topSellers = thisMonthAgg.slice(0, 5)
    const bottomSellers = [...thisMonthAgg].sort((a, b) => a.quantity - b.quantity).slice(0, 5)

    // All active products, to flag zero-sales items this month
    const { data: activeProducts } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, stock_status')
      .eq('brand_id', admin.brand_id)
      .eq('is_active', true)

    const soldProductIds = new Set(thisMonthAgg.map(p => p.product_id))
    const noSalesThisMonth = (activeProducts || []).filter(p => !soldProductIds.has(p.id))

    // Month-over-month comparison for insights
    const lastMonthAgg = aggregateByProduct(lastMonthItems)
    const lastMonthByProduct = new Map(lastMonthAgg.map(p => [p.product_id, p]))

    const thisMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0
    const lastMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0
    const revenueChangePct = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
      : null

    // Rule-based insights (no external AI call configured for this project)
    const insights: string[] = []

    if (topSellers[0]) {
      insights.push(`"${topSellers[0].name}" is this month's best seller with ${topSellers[0].quantity} units sold — consider featuring it or bundling it with slower-moving items.`)
    }

    for (const [productId, prevData] of lastMonthByProduct.entries()) {
      const nowData = thisMonthAgg.find(p => p.product_id === productId)
      const nowQty = nowData?.quantity || 0
      if (prevData.quantity >= 5 && nowQty <= prevData.quantity * 0.5) {
        insights.push(`"${prevData.name}" sales dropped from ${prevData.quantity} to ${nowQty} units month-over-month — worth checking pricing, stock availability, or reaching out to regular buyers.`)
        break
      }
    }

    if (noSalesThisMonth.length > 0) {
      const sample = noSalesThisMonth.slice(0, 3).map(p => p.name).join(', ')
      insights.push(`${noSalesThisMonth.length} active product${noSalesThisMonth.length > 1 ? 's have' : ' has'} had zero orders this month (e.g. ${sample}) — consider a promotion or reviewing if they should stay listed.`)
    }

    const lowStockTopSeller = topSellers.find((p: any) => {
      const prod = (activeProducts || []).find(ap => ap.id === p.product_id)
      return prod && (prod.stock_status === 'low_stock' || prod.stock_status === 'out_of_stock')
    })
    if (lowStockTopSeller) {
      insights.push(`"${lowStockTopSeller.name}" is a top seller but is running low on stock — reorder soon to avoid missing sales.`)
    }

    if (revenueChangePct !== null) {
      insights.push(
        revenueChangePct >= 0
          ? `Revenue is up ${revenueChangePct}% compared to last month.`
          : `Revenue is down ${Math.abs(revenueChangePct)}% compared to last month — review recent order volume and store activity.`
      )
    }

    if (insights.length === 0) {
      insights.push('Not enough order history yet to generate meaningful insights — check back once more orders come in.')
    }

    return apiSuccess({
      monthly_revenue: monthlyRevenue,
      revenue_by_type: revenueByType,
      top_sellers: topSellers,
      bottom_sellers: bottomSellers,
      no_sales_this_month: noSalesThisMonth.map(p => ({ id: p.id, name: p.name, sku: p.sku })),
      this_month_revenue: thisMonthRevenue,
      last_month_revenue: lastMonthRevenue,
      revenue_change_pct: revenueChangePct,
      insights,
      current_month_label: monthBuckets[monthBuckets.length - 1].label,
    })

  } catch (error: any) {
    console.error('[REPORTS API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
