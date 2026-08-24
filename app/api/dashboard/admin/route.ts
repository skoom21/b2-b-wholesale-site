import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAdmin()
    const supabase = await createServerSupabaseClient()

    // Every query below is explicitly brand-scoped rather than relying
    // solely on RLS — this route was previously unscoped and leaked every
    // brand's aggregate stats (revenue, orders, stores) to every admin,
    // regardless of which brand they belonged to.

    // Get total stores count by status
    const { data: stores } = await supabase
      .from('stores')
      .select('id, status, tier')
      .eq('brand_id', profile.brand_id)

    const totalStores = stores?.length || 0
    const activeStores = stores?.filter(s => s.status === 'active').length || 0
    const pendingStores = stores?.filter(s => s.status === 'pending').length || 0
    
    const tierBreakdown = {
      gold: stores?.filter(s => s.tier === 'gold').length || 0,
      silver: stores?.filter(s => s.tier === 'silver').length || 0,
      standard: stores?.filter(s => s.tier === 'standard').length || 0
    }
    
    // Get order statistics
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, total_amount, order_date')
      .eq('brand_id', profile.brand_id)

    const totalOrders = orders?.length || 0
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0
    const processingOrders = orders?.filter(o => o.status === 'processing' || o.status === 'confirmed').length || 0
    
    const totalRevenue = orders?.filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0
    
    // Get revenue for current month
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthlyRevenue = orders?.filter(o => {
      const orderDate = new Date(o.order_date)
      return orderDate >= firstDayOfMonth && o.status === 'delivered'
    }).reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0
    
    // Get recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        order_date,
        stores (
          id,
          name
        )
      `)
      .eq('brand_id', profile.brand_id)
      .order('order_date', { ascending: false })
      .limit(10)

    // Get low stock products
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold, stock_status')
      .eq('brand_id', profile.brand_id)
      .in('stock_status', ['low_stock', 'out_of_stock'])
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true })
      .limit(15)

    // Get product statistics
    const { data: products } = await supabase
      .from('products')
      .select('id, stock_status, is_active')
      .eq('brand_id', profile.brand_id)

    const totalProducts = products?.length || 0
    const activeProducts = products?.filter(p => p.is_active).length || 0
    const outOfStock = products?.filter(p => p.stock_status === 'out_of_stock').length || 0
    
    // Get pending stores that need approval
    const { data: pendingStoresList } = await supabase
      .from('stores')
      .select('id, name, email, city, store_type, created_at')
      .eq('brand_id', profile.brand_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)

    // Get overdue invoices. invoices has no brand_id column of its own —
    // scoped transitively via stores, matching the RLS policy's own idiom.
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total_amount,
        due_date,
        stores!inner (
          id,
          name,
          brand_id
        )
      `)
      .eq('stores.brand_id', profile.brand_id)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true })
      .limit(10)
    
    const overdueAmount = overdueInvoices?.reduce((sum, inv) => 
      sum + parseFloat(inv.total_amount.toString()), 0
    ) || 0
    
    return apiSuccess({
      stats: {
        stores: {
          total: totalStores,
          active: activeStores,
          pending: pendingStores,
          tiers: tierBreakdown
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          processing: processingOrders
        },
        revenue: {
          total: totalRevenue,
          monthly: monthlyRevenue
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          out_of_stock: outOfStock,
          low_stock: lowStockProducts?.filter(p => p.stock_status === 'low_stock').length || 0
        },
        invoices: {
          overdue_count: overdueInvoices?.length || 0,
          overdue_amount: overdueAmount
        }
      },
      recent_orders: recentOrders,
      low_stock_products: lowStockProducts,
      pending_stores: pendingStoresList,
      overdue_invoices: overdueInvoices
    })
    
  } catch (error: any) {
    console.error('[DASHBOARD API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
