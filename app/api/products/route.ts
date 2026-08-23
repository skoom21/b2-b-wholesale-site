import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireBrandContext, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError, apiBadRequest, apiValidationError } from '@/lib/api/response'
import { parsePagination, calculatePagination, getPaginationRange } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  try {
    const profile = await requireBrandContext()
    const supabase = await createServerSupabaseClient()
    const searchParams = request.nextUrl.searchParams
    
    // Parse pagination
    const { page, perPage } = parsePagination(searchParams)
    const { from, to } = getPaginationRange(page, perPage)
    
    // Parse filters
    const categoryId = searchParams.get('category_id')
    const stockStatus = searchParams.get('stock_status')
    const isActive = searchParams.get('is_active')
    const featured = searchParams.get('featured')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'name'
    const order = searchParams.get('order') || 'asc'
    
    // Build query
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        description,
        category_id,
        unit,
        unit_quantity,
        base_price,
        gold_price,
        silver_price,
        stock_quantity,
        stock_status,
        low_stock_threshold,
        weight,
        image_url,
        image_urls,
        is_active,
        featured,
        created_at,
        updated_at,
        categories (
          id,
          name,
          slug
        )
      `, { count: 'exact' })
      .eq('brand_id', profile.brand_id)

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    
    if (stockStatus) {
      query = query.eq('stock_status', stockStatus)
    }
    
    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }
    
    if (featured !== null && featured !== undefined) {
      query = query.eq('featured', featured === 'true')
    }
    
    // Search functionality
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    // Sorting
    const validSortFields = ['name', 'base_price', 'stock_quantity', 'created_at', 'sku']
    const sortField = validSortFields.includes(sort) ? sort : 'name'
    const sortOrder = order === 'desc' ? false : true
    
    query = query.order(sortField, { ascending: sortOrder })
    
    // Apply pagination
    query = query.range(from, to)
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('[PRODUCTS API] Error fetching products:', error)
      return apiError('Failed to fetch products', 'DATABASE_ERROR', 500, error)
    }
    
    // Get user's store tier for pricing
    let userTier: 'gold' | 'silver' | 'standard' = 'standard'
    if (profile.role === 'retailer') {
      const { data: store } = await supabase
        .from('stores')
        .select('tier')
        .eq('user_id', profile.id)
        .single()

      if (store) {
        userTier = store.tier
      }
    }
    
    // Add effective price for user's tier
    const productsWithPricing = data?.map(product => ({
      ...product,
      effective_price: userTier === 'gold' 
        ? (product.gold_price || product.base_price)
        : userTier === 'silver'
        ? (product.silver_price || product.base_price)
        : product.base_price
    }))
    
    const paginationMeta = calculatePagination(count || 0, page, perPage)
    
    return apiSuccess(productsWithPricing, paginationMeta)
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Error:', error)
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAdmin()
    if (!profile.brand_id) {
      return apiError('No brand context', 'FORBIDDEN', 403)
    }
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['name', 'category_id', 'base_price']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      return apiValidationError([{
        field: missingFields[0],
        message: `${missingFields[0]} is required`
      }])
    }

    // Generate SKU if not provided
    if (!body.sku) {
      const prefix = '819011'
      let isUnique = false
      let attempts = 0
      
      while (!isUnique && attempts < 5) {
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
        const generatedSku = prefix + random
        
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('sku', generatedSku)
          .single()
          
        if (!existing) {
          body.sku = generatedSku
          isUnique = true
        }
        attempts++
      }
      
      if (!isUnique) {
        return apiError('Failed to generate unique SKU', 'SKU_GENERATION_ERROR', 500)
      }
    }
    
    // Check if SKU already exists
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('sku', body.sku)
      .single()
    
    if (existingProduct) {
      return apiValidationError([{
        field: 'sku',
        message: 'A product with this SKU already exists'
      }])
    }
    
    // Validate category exists and belongs to the same brand
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', body.category_id)
      .eq('brand_id', profile.brand_id)
      .single()

    if (!category) {
      return apiValidationError([{
        field: 'category_id',
        message: 'Category not found'
      }])
    }
    
    // Validate price values
    if (body.base_price <= 0) {
      return apiValidationError([{
        field: 'base_price',
        message: 'Base price must be greater than 0'
      }])
    }
    
    if (body.gold_price && body.gold_price <= 0) {
      return apiValidationError([{
        field: 'gold_price',
        message: 'Gold price must be greater than 0'
      }])
    }
    
    if (body.silver_price && body.silver_price <= 0) {
      return apiValidationError([{
        field: 'silver_price',
        message: 'Silver price must be greater than 0'
      }])
    }
    
    // Validate stock values
    const stockQuantity = body.stock_quantity || 0
    const lowStockThreshold = body.low_stock_threshold || 10
    
    if (stockQuantity < 0) {
      return apiValidationError([{
        field: 'stock_quantity',
        message: 'Stock quantity cannot be negative'
      }])
    }
    
    // Determine stock status
    let stockStatus = 'in_stock'
    if (stockQuantity === 0) {
      stockStatus = 'out_of_stock'
    } else if (stockQuantity <= lowStockThreshold) {
      stockStatus = 'low_stock'
    }
    
    // Create product
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        brand_id: profile.brand_id,
        sku: body.sku,
        name: body.name,
        description: body.description || null,
        category_id: body.category_id,
        base_price: body.base_price,
        gold_price: body.gold_price || null,
        silver_price: body.silver_price || null,
        stock_quantity: stockQuantity,
        low_stock_threshold: lowStockThreshold,
        stock_status: stockStatus,
        image_url: body.image_url || null,
        featured: body.is_featured || false,
        is_active: body.is_active !== undefined ? body.is_active : true,
        unit: body.unit || 'Piece',
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return apiSuccess({ product }, 201)
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create product', 'CREATE_ERROR', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return apiBadRequest('Product IDs array is required')
    }
    
    // Check if any products are referenced in orders
    const { data: orderItems, error: orderCheckError } = await supabase
      .from('order_items')
      .select('product_id')
      .in('product_id', body.ids)
    
    if (orderCheckError) {
      throw orderCheckError
    }
    
    if (orderItems && orderItems.length > 0) {
      const referencedIds = [...new Set(orderItems.map(item => item.product_id))]
      return apiError(
        `Cannot delete products that have been ordered. ${referencedIds.length} product(s) are referenced in existing orders.`,
        'PRODUCTS_REFERENCED',
        409
      )
    }
    
    // Perform bulk delete
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .in('id', body.ids)
    
    if (deleteError) {
      throw deleteError
    }
    
    return apiSuccess({ 
      deleted: body.ids.length,
      message: `Successfully deleted ${body.ids.length} product(s)` 
    })
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Bulk delete error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to delete products', 'DELETE_ERROR', 500)
  }
}
