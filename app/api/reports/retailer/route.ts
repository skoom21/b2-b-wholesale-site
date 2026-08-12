import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound } from '@/lib/api/response'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('user_id', user.id)
      .single()

    if (storeError || !store) {
      return apiNotFound('Store not found for user')
    }

    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount, status, order_date')
      .eq('store_id', store.id)
      .gte('order_date', sixMonthsAgo.toISOString())

    if (ordersError) {
      return apiError('Failed to fetch orders for report', 'DATABASE_ERROR', 500, ordersError)
    }

    const validOrders = (orders || []).filter(o => o.status !== 'cancelled')

    const monthBuckets: { key: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthBuckets.push({ key: monthKey(d), label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` })
    }

    const monthlySpend = monthBuckets.map(bucket => {
      const total = validOrders
        .filter(o => monthKey(new Date(o.order_date)) === bucket.key)
        .reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0)
      return { month: bucket.label, spend: Math.round(total * 100) / 100 }
    })

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, product_name, product_sku, quantity, subtotal, orders!inner(order_date, status, store_id)')
      .eq('orders.store_id', store.id)
      .gte('orders.order_date', sixMonthsAgo.toISOString())

    if (itemsError) {
      return apiError('Failed to fetch order items for report', 'DATABASE_ERROR', 500, itemsError)
    }

    const validItems = (items || []).filter((i: any) => i.orders?.status !== 'cancelled')

    const productMap = new Map<string, { product_id: string; name: string; sku: string; quantity: number; spend: number }>()
    for (const row of validItems as any[]) {
      const existing = productMap.get(row.product_id)
      const qty = row.quantity || 0
      const spend = parseFloat(row.subtotal?.toString() || '0')
      if (existing) {
        existing.quantity += qty
        existing.spend += spend
      } else {
        productMap.set(row.product_id, { product_id: row.product_id, name: row.product_name, sku: row.product_sku, quantity: qty, spend })
      }
    }
    const mostPurchased = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8)

    const totalOrders = validOrders.length
    const totalSpend = validOrders.reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0)
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0

    return apiSuccess({
      store_name: store.name,
      monthly_spend: monthlySpend,
      most_purchased: mostPurchased,
      total_orders_6mo: totalOrders,
      total_spend_6mo: Math.round(totalSpend * 100) / 100,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
    })

  } catch (error: any) {
    console.error('[RETAILER REPORTS API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
