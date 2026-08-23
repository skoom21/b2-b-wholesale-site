import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth, getUserRole } from '@/lib/api/auth'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { parsePagination, calculatePagination } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = getUserRole(user)
    
    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = parsePagination(searchParams)
    
    // Extract filters
    const status = searchParams.get('status')
    const storeId = searchParams.get('store_id')
    
    // Build query
    let query = supabase
      .from('invoices')
      .select(`
        *,
        stores (
          id,
          name,
          email,
          tier
        )
      `, { count: 'exact' })
    
    // Apply RLS for retailers
    if (role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', user.id)
        .single()
      
      if (store) {
        query = query.eq('store_id', store.id)
      }
    } else if (storeId && (role === 'admin' || role === 'staff' || role === 'owner')) {
      // Admin/staff/owner can filter by store
      query = query.eq('store_id', storeId)
    }
    
    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    
    // Apply pagination and sorting
    const { data: invoices, error, count } = await query
      .order('due_date', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      throw error
    }
    
    const pagination = calculatePagination(count || 0, page, limit)
    
    return apiSuccess({ invoices, pagination })
    
  } catch (error: any) {
    console.error('[INVOICES API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Failed to fetch invoices', 'FETCH_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = getUserRole(user)
    const body = await request.json()
    
    // Only admins/staff can create invoices
    if (role !== 'admin' && role !== 'staff' && role !== 'owner') {
      return apiError('Only administrators can create invoices', 'FORBIDDEN', 403)
    }
    
    // Validate required fields
    const requiredFields = ['order_id']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      return apiValidationError([{
        field: missingFields[0],
        message: `${missingFields[0]} is required`
      }])
    }
    
    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, stores(payment_terms_days)')
      .eq('id', body.order_id)
      .single()
    
    if (orderError || !order) {
      return apiValidationError([{
        field: 'order_id',
        message: 'Order not found'
      }])
    }
    
    // Check if invoice already exists for this order
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('order_id', body.order_id)
      .single()
    
    if (existingInvoice) {
      return apiValidationError([{
        field: 'order_id',
        message: `Invoice ${existingInvoice.invoice_number} already exists for this order`
      }])
    }
    
    // Generate invoice number: INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const invoiceNumber = `INV-${dateStr}-${randomStr}`
    
    // Calculate due date (based on payment terms)
    const paymentTermsDays = order.stores?.payment_terms_days || 30
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + paymentTermsDays)
    
    // Create invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        order_id: body.order_id,
        store_id: order.store_id,
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total_amount: order.total_amount,
        amount_paid: 0,
        amount_due: order.total_amount,
        status: 'pending',
        issue_date: new Date().toISOString(),
        due_date: dueDate.toISOString(),
        notes: body.notes || null
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return apiSuccess({ invoice }, 201)
    
  } catch (error: any) {
    console.error('[INVOICES API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create invoice', 'CREATE_ERROR', 500)
  }
}
