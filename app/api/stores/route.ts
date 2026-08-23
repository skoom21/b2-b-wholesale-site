import { NextRequest } from 'next/server'
import { requireBrandContext, requireAdmin, createServerSupabaseClient } from '@/lib/api/auth'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { parsePagination, calculatePagination, getPaginationRange } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  try {
    const profile = await requireBrandContext()
    const supabase = await createServerSupabaseClient()

    const searchParams = request.nextUrl.searchParams
    const { page, perPage } = parsePagination(searchParams)
    const { from, to } = getPaginationRange(page, perPage)

    const status = searchParams.get('status')
    const tier = searchParams.get('tier')
    const storeType = searchParams.get('store_type')
    const search = searchParams.get('search')

    let query = supabase
      .from('stores')
      .select('*', { count: 'exact' })
      .eq('brand_id', profile.brand_id)

    // Retailers see only their own store; admin/staff see their whole brand's stores
    if (profile.role === 'retailer') {
      query = query.eq('user_id', profile.id)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (tier) {
      query = query.eq('tier', tier)
    }

    if (storeType) {
      query = query.eq('store_type', storeType)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: stores, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (dbError) {
      console.error('[STORES API] Database error:', dbError)
      return apiError('Failed to fetch stores', 'DATABASE_ERROR', 500, dbError)
    }

    const pagination = calculatePagination(count || 0, page, perPage)

    return apiSuccess({
      stores: stores || [],
      pagination
    })

  } catch (error: any) {
    console.error('[STORES API] Internal error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
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

    const requiredFields = ['name', 'email', 'phone', 'address_line1', 'city', 'province', 'postal_code']
    const missingFields = requiredFields.filter(field => !body[field])

    if (missingFields.length > 0) {
      return apiValidationError([{
        field: missingFields[0],
        message: `${missingFields[0]} is required`
      }])
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return apiValidationError([{
        field: 'email',
        message: 'Invalid email format'
      }])
    }

    const { data: existingStore } = await supabase
      .from('stores')
      .select('id')
      .eq('email', body.email)
      .single()

    if (existingStore) {
      return apiValidationError([{
        field: 'email',
        message: 'A store with this email already exists'
      }])
    }

    const validTiers = ['gold', 'silver', 'standard']
    if (body.tier && !validTiers.includes(body.tier)) {
      return apiValidationError([{
        field: 'tier',
        message: 'Invalid tier. Must be one of: gold, silver, standard'
      }])
    }

    const validStatuses = ['active', 'inactive', 'pending', 'suspended']
    if (body.status && !validStatuses.includes(body.status)) {
      return apiValidationError([{
        field: 'status',
        message: 'Invalid status. Must be one of: active, inactive, pending, suspended'
      }])
    }

    const validStoreTypes = ['grocery_store', 'restaurant', 'distributor', 'other']
    if (body.store_type && !validStoreTypes.includes(body.store_type)) {
      return apiValidationError([{
        field: 'store_type',
        message: 'Invalid store type. Must be one of: grocery_store, restaurant, distributor, other'
      }])
    }

    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        brand_id: profile.brand_id,
        name: body.name,
        email: body.email,
        phone: body.phone,
        address_line1: body.address_line1,
        address_line2: body.address_line2,
        city: body.city,
        province: body.province,
        postal_code: body.postal_code,
        country: body.country || 'Canada',
        store_type: body.store_type || 'other',
        tier: body.tier || 'standard',
        status: body.status || 'pending',
        tax_number: body.tax_number,
        credit_limit: body.credit_limit || 0,
        credit_used: 0,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return apiSuccess({ store }, 201)

  } catch (error: any) {
    console.error('[STORES API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create store', 'CREATE_ERROR', 500)
  }
}
