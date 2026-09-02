import { NextRequest } from 'next/server'
import { createServerSupabaseClient, getCurrentUserProfile } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const profile = await getCurrentUserProfile()

    if (!profile || !profile.brand_id) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }

    // Fetch featured products — scoped to the caller's own brand.
    const { data, error } = await supabase
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
        image_urls,
        featured,
        categories (
          id,
          name,
          slug
        )
      `)
      .eq('brand_id', profile.brand_id)
      .eq('featured', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12)

    if (error) {
      console.error('[PRODUCTS API] Error fetching featured products:', error)
      return apiError('Failed to fetch featured products', 'DATABASE_ERROR', 500, error)
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
    
    return apiSuccess(productsWithPricing)
    
  } catch (error: any) {
    console.error('[PRODUCTS API] Error:', error)
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
