import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireBrandContext } from '@/lib/api/auth'
import { apiSuccess, apiError, apiBadRequest, apiValidationError } from '@/lib/api/response'
import { parsePagination, calculatePagination, getPaginationRange } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  try {
    const profile = await requireBrandContext()
    const supabase = await createServerSupabaseClient()
    const searchParams = request.nextUrl.searchParams
    const role = profile.role
    
    // Parse pagination
    const { page, perPage } = parsePagination(searchParams)
    const { from, to } = getPaginationRange(page, perPage)
    
    // Parse filters
    const status = searchParams.get('status')
    const storeId = searchParams.get('store_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    
    console.log('[ORDERS API] Filters:', { status, storeId, dateFrom, dateTo })
    
    // Build query
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        store_id,
        status,
        subtotal,
        shipping_cost,
        tax_amount,
        discount_amount,
        total_amount,
        total_items,
        order_date,
        confirmed_at,
        shipped_at,
        delivered_at,
        cancelled_at,
        customer_notes,
        created_at,
        updated_at,
        stores (
          id,
          name,
          email,
          city,
          tier
        )
      `, { count: 'exact' })
      .eq('brand_id', profile.brand_id)

    // RLS: Retailers can only see their own orders
    if (role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', profile.id)
        .single()

      if (!store) {
        return apiError('Store not found for user', 'STORE_NOT_FOUND', 404)
      }

      query = query.eq('store_id', store.id)
    } else if (storeId && (role === 'admin' || role === 'staff')) {
      // Admin/staff can filter by store_id within their own brand
      query = query.eq('store_id', storeId)
    }
    
    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    
    if (dateFrom) {
      query = query.gte('order_date', dateFrom)
    }
    
    if (dateTo) {
      query = query.lte('order_date', dateTo)
    }
    
    // Sort by order_date descending (most recent first)
    query = query
      .order('order_date', { ascending: false })
      .range(from, to)
    
    console.log('[ORDERS API] Executing query...')
    const { data, error, count } = await query
    
    if (error) {
      console.error('[ORDERS API] Error fetching orders:', error)
      return apiError('Failed to fetch orders', 'DATABASE_ERROR', 500, error)
    }
    
    console.log('[ORDERS API] Query successful, count:', count, 'data length:', data?.length)
    const paginationMeta = calculatePagination(count || 0, page, perPage)
    
    return apiSuccess(data, paginationMeta)
    
  } catch (error: any) {
    console.error('[ORDERS API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireBrandContext()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // Validate request body
    const { items, shipping_address, customer_notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiBadRequest('Order must contain at least one item')
    }

    // Get user's store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, tier, status, credit_limit, credit_used')
      .eq('user_id', profile.id)
      .eq('brand_id', profile.brand_id)
      .single()
    
    if (storeError || !store) {
      return apiError('Store not found for user', 'STORE_NOT_FOUND', 404)
    }
    
    if (store.status !== 'active') {
      return apiError('Store is not active', 'STORE_INACTIVE', 403)
    }
    
    // Validate each item and calculate totals
    let subtotal = 0
    const validatedItems = []
    const errors: Record<string, string> = {}
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      if (!item.product_id || !item.quantity) {
        errors[`item_${i}`] = 'Product ID and quantity are required'
        continue
      }
      
      if (item.quantity <= 0) {
        errors[`item_${i}`] = 'Quantity must be greater than 0'
        continue
      }
      
      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, sku, name, unit, base_price, gold_price, silver_price, stock_quantity, stock_status, is_active')
        .eq('id', item.product_id)
        .single()
      
      if (productError || !product) {
        errors[`item_${i}`] = 'Product not found'
        continue
      }
      
      if (!product.is_active) {
        errors[`item_${i}`] = 'Product is not available'
        continue
      }
      
      if (product.stock_quantity < item.quantity) {
        errors[`item_${i}`] = `Insufficient stock. Available: ${product.stock_quantity}`
        continue
      }
      
      // Calculate price based on store tier
      const unitPrice = store.tier === 'gold'
        ? (product.gold_price || product.base_price)
        : store.tier === 'silver'
        ? (product.silver_price || product.base_price)
        : product.base_price
      
      const itemSubtotal = unitPrice * item.quantity
      subtotal += itemSubtotal
      
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        product_unit: product.unit,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal
      })
    }
    
    if (Object.keys(errors).length > 0) {
      return apiValidationError(errors)
    }
    
    // Calculate tax (13% HST for Canada)
    const taxAmount = subtotal * 0.13
    const shippingCost = body.shipping_cost || 0
    const discountAmount = body.discount_amount || 0
    const totalAmount = subtotal + taxAmount + shippingCost - discountAmount
    const totalItems = validatedItems.reduce((sum, item) => sum + item.quantity, 0)
    
    // Orders are post-paid (tracked as dues via invoices after the fact),
    // not gated by a pre-set credit limit. credit_limit/credit_used remain
    // available for admin reporting but no longer block checkout.

    // Generate order number
    const { data: orderNumberResult, error: orderNumberError } = await supabase
      .rpc('generate_order_number')

    if (orderNumberError) {
      console.error('[ORDERS API] Error generating order number:', orderNumberError)
      return apiError('Failed to generate order number', 'DATABASE_ERROR', 500)
    }

    // Create order. generate_order_number() derives the number from a plain
    // COUNT(*) of today's orders, which is not race-safe — two requests
    // landing close together can compute the same number and collide on
    // the orders_order_number_key unique constraint. Retry with a bumped
    // suffix on that specific collision instead of failing checkout.
    let orderNumber: string = orderNumberResult
    let order: any = null
    let orderError: any = null
    const baseOrderPayload: Record<string, any> = {
      store_id: store.id,
      brand_id: profile.brand_id,
      status: 'pending',
      subtotal,
      shipping_cost: shippingCost,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      total_items: totalItems,
      shipping_address_line1: shipping_address?.address_line1,
      shipping_address_line2: shipping_address?.address_line2,
      shipping_city: shipping_address?.city,
      shipping_province: shipping_address?.province,
      shipping_postal_code: shipping_address?.postal_code,
      shipping_country: shipping_address?.country || 'Canada',
      customer_notes,
    }
    let includeCreatedBy = true

    for (let attempt = 0; attempt < 5; attempt++) {
      const payload: Record<string, any> = { ...baseOrderPayload, order_number: orderNumber }
      if (includeCreatedBy) payload.created_by = profile.id

      const result = await supabase.from('orders').insert(payload).select().single()

      if (!result.error) {
        order = result.data
        orderError = null
        break
      }

      // created_by is an optional audit field referencing public.users(id).
      // If that row is out of sync with auth.users (a known issue in this
      // project), retry immediately without it rather than fail checkout
      // over an audit field.
      if (result.error.code === '23503' && result.error.message?.includes('created_by')) {
        console.warn('[ORDERS API] created_by FK violation, retrying without it:', result.error)
        includeCreatedBy = false
        continue
      }

      // Unique violation on order_number: bump the numeric suffix and retry.
      if (result.error.code === '23505' && result.error.message?.includes('order_number')) {
        console.warn(`[ORDERS API] order_number collision on ${orderNumber}, retrying with next number`)
        const match = orderNumber.match(/-(\d+)$/)
        const nextSuffix = match
          ? (parseInt(match[1], 10) + 1).toString().padStart(match[1].length, '0')
          : Date.now().toString().slice(-4)
        orderNumber = match ? orderNumber.replace(/-(\d+)$/, `-${nextSuffix}`) : `${orderNumber}-${nextSuffix}`
        continue
      }

      orderError = result.error
      break
    }

    if (orderError || !order) {
      console.error('[ORDERS API] Error creating order:', orderError)
      return apiError(
        orderError?.message ? `Failed to create order: ${orderError.message}` : 'Failed to create order',
        'DATABASE_ERROR',
        500,
        orderError
      )
    }
    
    // Create order items
    const orderItems = validatedItems.map(item => ({
      ...item,
      order_id: order.id
    }))
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
    
    if (itemsError) {
      console.error('[ORDERS API] Error creating order items:', itemsError)
      // Rollback: delete the order
      await supabase.from('orders').delete().eq('id', order.id)
      return apiError('Failed to create order items', 'DATABASE_ERROR', 500, itemsError)
    }

    // Auto-generate an invoice so the retailer immediately sees this order
    // as a due/balance owed (orders are post-paid, not blocked by credit limit).
    // Best-effort: never fails order placement if this insert doesn't go through.
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    const { error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        order_id: order.id,
        store_id: store.id,
        status: 'sent',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        amount_paid: 0,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
      })
    if (invoiceError) {
      console.error('[ORDERS API] Failed to auto-create invoice (order still succeeds):', invoiceError)
    }

    // Fetch complete order with items
    const { data: completeOrder } = await supabase
      .from('orders')
      .select(`
        *,
        stores (
          id,
          name,
          email,
          tier
        )
      `)
      .eq('id', order.id)
      .single()
    
    const { data: createdItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
    
    return apiSuccess({
      ...completeOrder,
      items: createdItems
    })
    
  } catch (error: any) {
    console.error('[ORDERS API] Error creating order:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
