import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createServerSupabaseClient()
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, slug, public_description, logo_url, contact_email, contact_phone')
      .eq('slug', slug.toLowerCase())
      .eq('status', 'active')
      .eq('public_catalog_enabled', true)
      .single()

    if (brandError || !brand) return apiNotFound('Brand storefront not found')

    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, description, sku, unit, unit_quantity, image_url, stock_status, featured, categories(name)')
      .eq('brand_id', brand.id)
      .eq('is_active', true)
      .order('featured', { ascending: false })
      .order('name', { ascending: true })
      .limit(100)

    if (productError) return apiError('Failed to load catalog', 'DATABASE_ERROR', 500, productError)
    return apiSuccess({ brand, products: products || [] })
  } catch (error: any) {
    return apiError(error.message || 'Failed to load storefront', 'INTERNAL_ERROR', 500)
  }
}
