import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'
import { parsePagination, calculatePagination, getPaginationRange } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const supabase = await createServerSupabaseClient()

    const { searchParams } = new URL(request.url)
    const { page, perPage } = parsePagination(searchParams)
    const { from, to } = getPaginationRange(page, perPage)

    // Extract filters
    const productId = searchParams.get('product_id')
    const transactionType = searchParams.get('transaction_type')
    const referenceType = searchParams.get('reference_type')
    const referenceId = searchParams.get('reference_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Build query — inventory_transactions has no brand_id of its own,
    // scoped transitively through the (inner-joined) product's brand_id.
    let query = supabase
      .from('inventory_transactions')
      .select(`
        *,
        products!inner (
          id,
          sku,
          name,
          image_url,
          brand_id
        )
      `, { count: 'exact' })
      .eq('products.brand_id', admin.brand_id)

    // Apply filters
    if (productId) {
      query = query.eq('product_id', productId)
    }
    
    if (transactionType) {
      query = query.eq('transaction_type', transactionType)
    }
    
    if (referenceType) {
      query = query.eq('reference_type', referenceType)
    }
    
    if (referenceId) {
      query = query.eq('reference_id', referenceId)
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    
    // Apply pagination and sorting
    const { data: transactions, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    const pagination = calculatePagination(count || 0, page, perPage)
    
    return apiSuccess({ transactions, pagination })
    
  } catch (error: any) {
    console.error('[INVENTORY API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to fetch inventory transactions', 'FETCH_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.product_id || !body.transaction_type || body.quantity_change === undefined) {
      return apiError('Missing required fields: product_id, transaction_type, quantity_change', 'VALIDATION_ERROR', 400)
    }

    // Fetch current product stock — scoped to admin's own brand, so a
    // request can't adjust another brand's product stock by ID.
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, low_stock_threshold')
      .eq('id', body.product_id)
      .eq('brand_id', admin.brand_id)
      .single()
    
    if (productError || !product) {
      return apiError('Product not found', 'NOT_FOUND', 404)
    }
    
    const quantityBefore = product.stock_quantity
    const quantityAfter = quantityBefore + body.quantity_change
    
    // Prevent negative stock
    if (quantityAfter < 0) {
      return apiError('Transaction would result in negative stock', 'INVALID_TRANSACTION', 400)
    }
    
    // Create transaction
    const { data: transaction, error } = await supabase
      .from('inventory_transactions')
      .insert({
        product_id: body.product_id,
        transaction_type: body.transaction_type,
        quantity_change: body.quantity_change,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        reference_type: body.reference_type || 'manual',
        reference_id: body.reference_id || null,
        notes: body.notes || null,
        created_by: admin.id
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    // Update product stock
    let stockStatus = 'in_stock'
    if (quantityAfter === 0) {
      stockStatus = 'out_of_stock'
    } else if (quantityAfter <= product.low_stock_threshold) {
      stockStatus = 'low_stock'
    }
    
    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: quantityAfter,
        stock_status: stockStatus
      })
      .eq('id', body.product_id)
      .eq('brand_id', admin.brand_id)
    
    if (updateError) {
      console.error('[INVENTORY API] Failed to update product stock:', updateError)
    }
    
    return apiSuccess({ transaction }, 201)
    
  } catch (error: any) {
    console.error('[INVENTORY API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create inventory transaction', 'CREATE_ERROR', 500)
  }
}
