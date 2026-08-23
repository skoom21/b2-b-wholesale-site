import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiForbidden, apiValidationError, apiBadRequest } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const profile = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = profile.role

    // Fetch order with all details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        stores (
          id,
          name,
          email,
          phone,
          city,
          province,
          postal_code,
          tier,
          status
        )
      `)
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return apiNotFound('Order not found')
    }

    const isOwner = role === 'owner'
    const isAdminLike = (role === 'admin' || role === 'staff') && profile.brand_id === order.brand_id

    // RLS: Check if retailer owns this order, or admin/staff belongs to its brand
    if (role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', profile.id)
        .single()

      if (!store || order.store_id !== store.id) {
        return apiForbidden('Access denied to this order')
      }
    } else if (!isOwner && !isAdminLike) {
      return apiForbidden('Access denied to this order')
    }
    
    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        product_name,
        product_sku,
        product_unit,
        quantity,
        unit_price,
        subtotal,
        created_at,
        products (
          id,
          name,
          sku,
          image_url,
          stock_status
        )
      `)
      .eq('order_id', id)
      .order('created_at', { ascending: true })
    
    if (itemsError) {
      console.error('[ORDERS API] Error fetching order items:', itemsError)
      return apiError('Failed to fetch order items', 'DATABASE_ERROR', 500, itemsError)
    }
    
    return apiSuccess({
      ...order,
      items
    })
    
  } catch (error: any) {
    console.error('[ORDERS API] Error fetching order:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const profile = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = profile.role
    const body = await request.json()

    // Fetch existing order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, stores(tier)')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return apiNotFound('Order not found')
    }

    const isOwner = role === 'owner'
    const isAdminLike = (role === 'admin' || role === 'staff') && profile.brand_id === order.brand_id

    // RLS: Check permissions
    if (role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', profile.id)
        .single()

      if (!store || order.store_id !== store.id) {
        return apiForbidden('Access denied to this order')
      }

      // Retailers can only cancel pending orders
      if (body.status && body.status !== 'cancelled') {
        return apiForbidden('Retailers can only cancel orders')
      }

      if (body.status === 'cancelled' && order.status !== 'pending') {
        return apiBadRequest('Can only cancel pending orders')
      }
    } else if (!isOwner && !isAdminLike) {
      return apiForbidden('Access denied to this order')
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ['pending', 'processing', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled']
      if (!validStatuses.includes(body.status)) {
        return apiValidationError([{
          field: 'status',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }])
      }

      // Validate status workflow (admin/staff/owner)
      if (isOwner || isAdminLike) {
        const statusFlow: { [key: string]: string[] } = {
          'pending': ['processing', 'confirmed', 'cancelled'],
          'processing': ['confirmed', 'cancelled'],
          'confirmed': ['out_for_delivery', 'cancelled'],
          'out_for_delivery': ['delivered', 'cancelled'],
          'delivered': [],
          'cancelled': []
        }

        const allowedTransitions = statusFlow[order.status] || []
        if (!allowedTransitions.includes(body.status)) {
          return apiBadRequest(
            `Cannot transition from ${order.status} to ${body.status}. ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
          )
        }

        // Reserve stock when order is confirmed
        if (body.status === 'confirmed' && order.status !== 'confirmed') {
          try {
            await supabase.rpc('reserve_order_stock', { p_order_id: id })
          } catch (stockError: any) {
            console.error('[ORDERS API] Stock reservation error (continuing):', stockError)
          }
        }

        // Update credit used when order is delivered
        if (body.status === 'delivered' && order.status !== 'delivered') {
          const { data: storeRow } = await supabase
            .from('stores')
            .select('credit_used')
            .eq('id', order.store_id)
            .single()
          if (storeRow) {
            const { error: creditError } = await supabase
              .from('stores')
              .update({ credit_used: parseFloat(storeRow.credit_used?.toString() || '0') + parseFloat(order.total_amount.toString()) })
              .eq('id', order.store_id)
            if (creditError) {
              console.error('[ORDERS API] Credit update error:', creditError)
            }
          }
        }

        // Restore credit if order is cancelled after being delivered
        if (body.status === 'cancelled' && order.status === 'delivered') {
          const { data: storeRow } = await supabase
            .from('stores')
            .select('credit_used')
            .eq('id', order.store_id)
            .single()
          if (storeRow) {
            const { error: creditError } = await supabase
              .from('stores')
              .update({ credit_used: Math.max(0, parseFloat(storeRow.credit_used?.toString() || '0') - parseFloat(order.total_amount.toString())) })
              .eq('id', order.store_id)
            if (creditError) {
              console.error('[ORDERS API] Credit restore error:', creditError)
            }
          }
        }
      }
    }
    
    // Prepare update data
    const updateData: any = {}
    
    if (body.status) {
      updateData.status = body.status
    }
    
    // Admin/staff/owner can update additional fields
    if (isOwner || isAdminLike) {
      if (body.shipping_cost !== undefined) updateData.shipping_cost = body.shipping_cost
      if (body.discount_amount !== undefined) updateData.discount_amount = body.discount_amount
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.tracking_number !== undefined) updateData.tracking_number = body.tracking_number
      if (body.shipped_date !== undefined) updateData.shipped_date = body.shipped_date
      if (body.delivered_date !== undefined) updateData.delivered_date = body.delivered_date
      
      // Recalculate totals if shipping or discount changed
      if (body.shipping_cost !== undefined || body.discount_amount !== undefined) {
        const shippingCost = body.shipping_cost !== undefined ? body.shipping_cost : order.shipping_cost
        const discountAmount = body.discount_amount !== undefined ? body.discount_amount : order.discount_amount
        
        updateData.total_amount = 
          parseFloat(order.subtotal.toString()) + 
          parseFloat(shippingCost.toString()) + 
          parseFloat(order.tax_amount.toString()) - 
          parseFloat(discountAmount.toString())
      }
    }
    
    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return apiBadRequest('No valid fields to update')
    }
    
    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return apiSuccess({ order: updatedOrder })
    
  } catch (error: any) {
    console.error('[ORDERS API] Error updating order:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to update order', 'UPDATE_ERROR', 500)
  }
}
