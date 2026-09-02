import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    
    // Get user's store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, tier, status, credit_limit, credit_used, payment_model, billing_frequency, next_billing_date, brand_id')
      .eq('user_id', user.id)
      .single()
    
    if (storeError || !store) {
      return apiError('Store not found for user', 'STORE_NOT_FOUND', 404)
    }
    
    // Get order statistics
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, total_amount, order_date')
      .eq('store_id', store.id)
    
    const totalOrders = orders?.length || 0
    const activeOrders = orders?.filter(o => 
      o.status === 'pending' || o.status === 'processing' || o.status === 'out_for_delivery'
    ).length || 0
    
    const totalSpent = orders?.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0
    
    // Get recent orders (last 5)
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        order_date,
        created_at
      `)
      .eq('store_id', store.id)
      .order('order_date', { ascending: false })
      .limit(5)
    
    // Get low stock alerts, scoped to the retailer's own brand.
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold')
      .eq('brand_id', store.brand_id)
      .in('stock_status', ['low_stock', 'out_of_stock'])
      .eq('is_active', true)
      .limit(10)
    
    const lowStockAlerts = lowStockProducts?.length || 0
    
    // Get unpaid invoices
    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, amount_paid, due_date')
      .eq('store_id', store.id)
      .in('status', ['sent', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(5)
    
    // Calculate amount_due and days_overdue for each invoice
    const unpaidInvoicesWithDetails = unpaidInvoices?.map(inv => {
      const total = parseFloat(inv.total_amount.toString())
      const paid = parseFloat((inv.amount_paid || 0).toString())
      const amount_due = total - paid
      const dueDate = new Date(inv.due_date)
      const today = new Date()
      const days_overdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        total_amount: total,
        amount_due,
        days_overdue,
        due_date: inv.due_date
      }
    }) || []
    
    const unpaidInvoicesAmount = unpaidInvoicesWithDetails.reduce((sum, inv) => 
      sum + inv.amount_due, 0
    )
    
    return apiSuccess({
      store: {
        id: store.id,
        name: store.name,
        tier: store.tier,
        status: store.status,
        credit_limit: store.credit_limit,
        credit_used: store.credit_used,
        credit_available: parseFloat(store.credit_limit.toString()) - parseFloat(store.credit_used.toString()),
        payment_model: store.payment_model || 'credit',
        billing_frequency: store.billing_frequency,
        next_billing_date: store.next_billing_date
      },
      stats: {
        total_orders: totalOrders,
        active_orders: activeOrders,
        total_spent: totalSpent,
        low_stock_alerts: lowStockAlerts,
        unpaid_invoices: unpaidInvoicesWithDetails.length,
        unpaid_amount: unpaidInvoicesAmount
      },
      recent_orders: recentOrders,
      unpaid_invoices: unpaidInvoicesWithDetails,
      low_stock_products: lowStockProducts
    })
    
  } catch (error: any) {
    console.error('[DASHBOARD API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
