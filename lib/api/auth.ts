import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '../types'
import { createMockSupabaseClient, hasSupabaseConfig } from '../supabase/client'

export async function createServerSupabaseClient() {
  if (!hasSupabaseConfig()) {
    console.warn('[AUTH] Missing Supabase config; using local mock client')
    return createMockSupabaseClient()
  }

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  console.log('[AUTH] Creating Supabase client with cookies:', allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })))
  
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  
  // Immediately verify the session is loaded
  const { data: { session } } = await client.auth.getSession()
  console.log('[AUTH] Session loaded:', { 
    hasSession: !!session, 
    userId: session?.user?.id,
    accessToken: session?.access_token?.substring(0, 20) + '...'
  })
  
  return client
}

export async function getAuthUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function requireAuth() {
  const user = await getAuthUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  const role = user.user_metadata?.role || 'retailer'
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }
  
  return user
}

export function getUserRole(user: any): 'admin' | 'retailer' | 'manager' {
  return user?.user_metadata?.role || 'retailer'
}
