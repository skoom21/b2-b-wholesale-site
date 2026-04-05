import { NextRequest } from 'next/server'
import { createServerSupabaseClient, getAuthUser, getUserRole, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError, apiBadRequest, apiValidationError } from '@/lib/api/response'
import { parsePagination, calculatePagination, getPaginationRange } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('[STORES API] Auth error:', authError)
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    
    // Get user's profile for reliable role check
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const role = profile?.role || user.user_metadata?.role || 'retailer'
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const { page, perPage } = parsePagination(searchParams)
    const { from, to } = getPaginationRange(page, perPage)
    
    const status = searchParams.get('status')
    const tier = searchParams.get('tier')
    const storeType = searchParams.get('store_type')
    const search = searchParams.get('search')
    
    // Build query
    let query = supabase
      .from('stores')
      .select('*', { count: 'exact' })
    
    // Admins and Managers see all stores
    // Retailers see only their own stores
    if (role === 'retailer') {
      query = query.eq('user_id', user.id)
    }
    
    // Apply filters
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
    
    // Apply sorting and pagination
    const { data: stores, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
    
    if (dbError) {
      console.error('[STORES API] Database error:', dbError)
      return apiError('Failed to fetch stores', 'DATABASE_ERROR', 500, dbError)
    }
    
    const pagination = calculatePagination(count || 0, page, perPage)
    
    // Return structured response
    return apiSuccess({ 
      stores: stores || [], 
      pagination 
    })
    
  } catch (error: any) {
    console.error('[STORES API] Internal error:', error)
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'address_line1', 'city', 'province', 'postal_code']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      return apiValidationError([{
        field: missingFields[0],
        message: `${missingFields[0]} is required`
      }])
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return apiValidationError([{
        field: 'email',
        message: 'Invalid email format'
      }])
    }
    
    // Check if email already exists
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
    
    // Validate tier if provided
    const validTiers = ['gold', 'silver', 'standard']
    if (body.tier && !validTiers.includes(body.tier)) {
      return apiValidationError([{
        field: 'tier',
        message: 'Invalid tier. Must be one of: gold, silver, standard'
      }])
    }
    
    // Validate status if provided
    const validStatuses = ['active', 'inactive', 'pending', 'suspended']
    if (body.status && !validStatuses.includes(body.status)) {
      return apiValidationError([{
        field: 'status',
        message: 'Invalid status. Must be one of: active, inactive, pending, suspended'
      }])
    }
    
    // Validate store_type if provided
    const validStoreTypes = ['grocery_store', 'restaurant', 'distributor', 'other']
    if (body.store_type && !validStoreTypes.includes(body.store_type)) {
      return apiValidationError([{
        field: 'store_type',
        message: 'Invalid store type. Must be one of: grocery_store, restaurant, distributor, other'
      }])
    }
    
    // Create store
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
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
        website: body.website,
        credit_limit: body.credit_limit || 0,
        credit_used: 0,
        payment_terms_days: body.payment_terms_days || 30
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
