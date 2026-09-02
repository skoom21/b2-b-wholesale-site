import { NextRequest } from 'next/server'
import { createServerSupabaseClient, getCurrentUserProfile } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound } from '@/lib/api/response'
import { parsePagination, calculatePagination, getPaginationRange } from '@/lib/api/pagination'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const profile = await getCurrentUserProfile()
    const searchParams = request.nextUrl.searchParams

    if (!profile || !profile.brand_id) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }

    // Check the category exists AND belongs to the caller's own brand —
    // without this, a category ID from any brand's catalog was browsable.
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('brand_id', profile.brand_id)
      .single()

    if (categoryError || !category) {
      return apiNotFound('Category not found')
    }

    // Parse pagination
    const { page, perPage } = parsePagination(searchParams)
    const { from, to } = getPaginationRange(page, perPage)

    // Fetch products in this category
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        description,
        category_id,
        unit,
        base_price,
        gold_price,
        silver_price,
        stock_quantity,
        stock_status,
        image_url,
        is_active
      `, { count: 'exact' })
      .eq('category_id', id)
      .eq('brand_id', profile.brand_id)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(from, to)

    const { data: products, error: productsError, count } = await query

    if (productsError) {
      console.error('[CATEGORIES API] Error fetching products:', productsError)
      return apiError('Failed to fetch products', 'DATABASE_ERROR', 500, productsError)
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
    const productsWithPricing = products?.map(product => ({
      ...product,
      effective_price: userTier === 'gold' 
        ? (product.gold_price || product.base_price)
        : userTier === 'silver'
        ? (product.silver_price || product.base_price)
        : product.base_price
    }))
    
    const paginationMeta = calculatePagination(count || 0, page, perPage)
    
    return apiSuccess({
      category,
      products: productsWithPricing
    }, paginationMeta)
    
  } catch (error: any) {
    console.error('[CATEGORIES API] Error:', error)
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
