import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth, getUserRole } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiForbidden, apiValidationError, apiBadRequest } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = getUserRole(user)
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        stores (
          id,
          name,
          email,
          phone,
          address,
          city,
          province,
          postal_code,
          tier,
          brand_id
        ),
        orders (
          id,
          order_number,
          order_date,
          status
        )
      `)
      .eq('id', id)
      .single()

    if (error || !invoice) {
      return apiNotFound('Invoice not found')
    }

    // Check if retailer owns this invoice
    if (role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!store || invoice.store_id !== store.id) {
        return apiForbidden('Access denied to this invoice')
      }
    } else if (role === 'admin' || role === 'staff') {
      // Invoices have no brand_id of their own — scoped transitively via
      // the store. Without this check, any admin could fetch any other
      // brand's invoice by ID.
      if ((invoice.stores as any)?.brand_id !== user.brand_id) {
        return apiForbidden('Access denied to this invoice')
      }
    }

    return apiSuccess({ invoice })
    
  } catch (error: any) {
    console.error('[INVOICES API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Failed to fetch invoice', 'FETCH_ERROR', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = getUserRole(user)
    const body = await request.json()
    
    // Only admins/staff can update invoices
    if (role !== 'admin' && role !== 'staff' && role !== 'owner') {
      return apiForbidden('Only administrators can update invoices')
    }
    
    // Fetch existing invoice, scoped transitively via its store's brand —
    // owner can update any brand's invoices, admin/staff only their own.
    let invoiceQuery = supabase
      .from('invoices')
      .select('*, stores!inner(brand_id)')
      .eq('id', id)
    if (role !== 'owner') {
      invoiceQuery = invoiceQuery.eq('stores.brand_id', user.brand_id)
    }
    const { data: invoice, error: fetchError } = await invoiceQuery.single()

    if (fetchError || !invoice) {
      return apiNotFound('Invoice not found')
    }

    const updateData: any = {}
    
    // Handle payment
    if (body.amount_paid !== undefined) {
      if (body.amount_paid < 0) {
        return apiValidationError([{
          field: 'amount_paid',
          message: 'Amount paid cannot be negative'
        }])
      }
      
      if (body.amount_paid > parseFloat(invoice.total_amount.toString())) {
        return apiValidationError([{
          field: 'amount_paid',
          message: 'Amount paid cannot exceed total amount'
        }])
      }
      
      updateData.amount_paid = body.amount_paid
      updateData.amount_due = parseFloat(invoice.total_amount.toString()) - body.amount_paid
      
      // Update status based on payment
      if (body.amount_paid === 0) {
        updateData.status = 'pending'
      } else if (body.amount_paid < parseFloat(invoice.total_amount.toString())) {
        updateData.status = 'partial'
      } else {
        updateData.status = 'paid'
        updateData.paid_date = new Date().toISOString()
      }
      
      // Check if overdue
      const dueDate = new Date(invoice.due_date)
      const now = new Date()
      if (now > dueDate && updateData.status !== 'paid') {
        updateData.status = 'overdue'
      }
    }
    
    // Update status manually if provided
    if (body.status) {
      const validStatuses = ['pending', 'partial', 'paid', 'overdue', 'cancelled']
      if (!validStatuses.includes(body.status)) {
        return apiValidationError([{
          field: 'status',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }])
      }
      updateData.status = body.status
      
      if (body.status === 'paid' && !invoice.paid_date) {
        updateData.paid_date = new Date().toISOString()
      }
      
      if (body.status === 'cancelled') {
        updateData.cancelled_date = new Date().toISOString()
      }
    }
    
    // Update notes if provided
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }
    
    // Update payment method if provided
    if (body.payment_method) {
      updateData.payment_method = body.payment_method
    }
    
    // Update transaction reference if provided
    if (body.payment_reference) {
      updateData.payment_reference = body.payment_reference
    }
    
    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return apiBadRequest('No valid fields to update')
    }
    
    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return apiSuccess({ invoice: updatedInvoice })
    
  } catch (error: any) {
    console.error('[INVOICES API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to update invoice', 'UPDATE_ERROR', 500)
  }
}
