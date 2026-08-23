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

  return client
}

// Raw Supabase Auth user (JWT-backed). Kept for loose/optional-auth call
// sites that don't need authorization or brand scoping (e.g. public
// product listings that only check "is someone logged in at all").
export async function getAuthUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export type UserRole = 'owner' | 'admin' | 'staff' | 'retailer' | 'manager'

export type UserProfile = {
  id: string
  email: string
  role: UserRole
  brand_id: string | null
  is_active: boolean
}

// The canonical, DB-backed identity + role + brand for every route that
// actually needs to authorize or scope a query. public.users is the
// single source of truth here (not the JWT's user_metadata, which two
// stores routes used to prefer inconsistently, and which can't carry
// brand_id without another sync mechanism). Client-side/cosmetic
// redirect guards (lib/auth.ts, proxy.ts) intentionally keep reading
// user_metadata.role instead — that's not the security boundary, RLS +
// these helpers are.
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, role, brand_id, is_active')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  return profile as UserProfile
}

export async function requireAuth(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    throw new Error('Unauthorized')
  }
  return profile
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireAuth()
  if (!['admin', 'staff'].includes(profile.role)) {
    throw new Error('Forbidden: Admin access required')
  }
  return profile
}

export async function requireOwner(): Promise<UserProfile> {
  const profile = await requireAuth()
  if (profile.role !== 'owner') {
    throw new Error('Forbidden: Owner access required')
  }
  return profile
}

// Every brand-scoped route (almost everything except owner-only routes)
// uses this and filters its queries by the returned brand_id.
export async function requireBrandContext(): Promise<UserProfile & { brand_id: string }> {
  const profile = await requireAuth()
  if (!profile.brand_id) {
    throw new Error('Forbidden: No brand context')
  }
  return profile as UserProfile & { brand_id: string }
}

// Accepts either the new canonical profile (.role directly) or a raw
// Supabase Auth user (.user_metadata.role) as a safety net for any
// call site still passing the old shape.
export function getUserRole(user: any): UserRole {
  return user?.role || user?.user_metadata?.role || 'retailer'
}
