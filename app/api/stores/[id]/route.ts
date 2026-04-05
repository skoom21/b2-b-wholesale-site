import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin, getAuthUser } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiValidationError, apiForbidden } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    const supabase = await createServerSupabaseClient()
    
    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !store) {
      return apiNotFound('Store not found')
    }
    
    // RLS check for retailers
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role, store_id')
        .eq('id', user.id)
        .single()
      
      const role = profile?.role || user.user_metadata?.role || 'retailer'
      const isAdmin = role === 'admin' || role === 'manager'
      
      if (!isAdmin && profile?.store_id !== id) {
        return apiForbidden('You can only access your own store')
      }
    }
    
    return apiSuccess({ store })
    
  } catch (error: any) {
    console.error('[STORES API] Error:', error)
    return apiError(error.message || 'Failed to fetch store', 'FETCH_ERROR', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    
    // Check if store exists
    const { data: existingStore, error: fetchError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !existingStore) {
      return apiNotFound('Store not found')
    }
    
    // Get user profile to check permissions
    const { data: profile } = await supabase
      .from('users')
      .select('role, store_id')
      .eq('id', user!.id)
      .single()
    
    const role = profile?.role || user!.user_metadata?.role || 'retailer'
    const isAdmin = role === 'admin' || role === 'manager'
    const isOwnStore = profile?.store_id === id
    
    // Only admin or store owner can update
    if (!isAdmin && !isOwnStore) {
      return apiForbidden('You do not have permission to update this store')
    }
    
    // Prepare update data
    const updateData: any = {}
    
    // Fields that both admin and retailer can update
    const commonFields = ['name', 'phone', 'address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country', 'website']
    commonFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })
    
    // Support 'address' field as alias for 'address_line1' for backward compatibility
    if (body.address !== undefined && body.address_line1 === undefined) {
      updateData.address_line1 = body.address
    }
    
    // Admin-only fields
    if (isAdmin) {
      const adminFields = ['email', 'tier', 'status', 'store_type', 'credit_limit', 'payment_terms_days', 'tax_number']
      adminFields.forEach(field => {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      })
      
      // Validate tier if provided
      if (body.tier && !['gold', 'silver', 'standard'].includes(body.tier)) {
        return apiValidationError([{
          field: 'tier',
          message: 'Invalid tier. Must be one of: gold, silver, standard'
        }])
      }
      
      // Validate status if provided
      if (body.status && !['active', 'inactive', 'pending', 'suspended'].includes(body.status)) {
        return apiValidationError([{
          field: 'status',
          message: 'Invalid status. Must be one of: active, inactive, pending, suspended'
        }])
      }
      
      // Validate store_type if provided
      if (body.store_type && !['grocery_store', 'restaurant', 'distributor', 'other'].includes(body.store_type)) {
        return apiValidationError([{
          field: 'store_type',
          message: 'Invalid store type. Must be one of: grocery_store, restaurant, distributor, other'
        }])
      }
    }
    
    // Validate email format if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updateData.email)) {
        return apiValidationError([{
          field: 'email',
          message: 'Invalid email format'
        }])
      }
      
      // Check if email is already used by another store
      const { data: duplicateStore } = await supabase
        .from('stores')
        .select('id')
        .eq('email', updateData.email)
        .neq('id', id)
        .single()
      
      if (duplicateStore) {
        return apiValidationError([{
          field: 'email',
          message: 'A store with this email already exists'
        }])
      }
    }
    
    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return apiBadRequest('No valid fields to update')
    }
    
    // Update store
    const { data: store, error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return apiSuccess({ store })
    
  } catch (error: any) {
    console.error('[STORES API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED', 
                     error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to update store', 'UPDATE_ERROR', 500)
  }
}
