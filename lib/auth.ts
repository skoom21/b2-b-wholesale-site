import { createClient } from './supabase/client'
import type { Store, StoreType, StoreTier } from './types'

// Authentication - Using Supabase auth.users only
export async function signUp(email: string, password: string, userData: {
  full_name: string
  phone?: string
}) {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: userData.full_name,
        phone: userData.phone,
        role: 'retailer',
      }
    }
  })

  if (error) throw error
  if (!data.user) throw new Error('Failed to create user')

  return { user: data.user, session: data.session }
}

export async function signIn(email: string, password: string) {
  console.log('[AUTH] signIn called with email:', email)
  const supabase = createClient()
  
  try {
    console.log('[AUTH] Attempting signInWithPassword...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('[AUTH] signInWithPassword response:', { 
      hasUser: !!data.user, 
      hasSession: !!data.session,
      error: error?.message 
    })

    if (error) {
      console.error('[AUTH] Supabase signIn error:', error)
      throw error
    }
    if (!data.user) {
      console.error('[AUTH] No user returned from signIn')
      throw new Error('Failed to sign in')
    }
    if (!data.session) {
      console.warn('[AUTH] No session returned from signIn')
    }

    console.log('[AUTH] signIn successful, user ID:', data.user.id)
    return { user: data.user, session: data.session }
  } catch (error: any) {
    console.error('[AUTH] Sign in error:', error)
    throw new Error(error.message || 'Failed to sign in')
  }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function getUserRole(user: any): 'admin' | 'retailer' {
  // Check user_metadata for role, default to 'retailer'
  return user?.user_metadata?.role || 'retailer'
}

// Store Management
export async function createStore(userId: string, storeData: {
  name: string
  email: string
  phone?: string
  store_type: StoreType
  city: string
  address_line1?: string
  address_line2?: string
  province?: string
  postal_code?: string
}) {
  const supabase = createClient()

  // Validate required fields
  if (!storeData.name || !storeData.email || !storeData.store_type || !storeData.city) {
    throw new Error('Missing required store information')
  }

  // stores.brand_id is NOT NULL; public self-registration has no
  // brand-picker UI yet, so every new store hardcodes to Teetoz, same
  // as handle_new_user() does for the user's own row.
  const { data: brandId, error: brandError } = await supabase.rpc('teetoz_brand_id')
  if (brandError || !brandId) {
    throw new Error('Failed to resolve brand for new store')
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({
      user_id: userId,
      brand_id: brandId,
      name: storeData.name,
      email: storeData.email,
      phone: storeData.phone || null,
      store_type: storeData.store_type,
      city: storeData.city,
      address_line1: storeData.address_line1 || null,
      address_line2: storeData.address_line2 || null,
      province: storeData.province || 'ON',
      postal_code: storeData.postal_code || null,
      tier: 'standard' as StoreTier,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Store creation failed:', error)
    throw new Error(error.message || 'Failed to create store')
  }
  
  return data
}


export async function getStoreByUserId(userId: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateUserLastLogin(userId: string) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) console.error('Update last login error:', error)
}
