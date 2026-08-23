import { createClient as createRawClient } from '@supabase/supabase-js'
import { hasSupabaseConfig } from '../supabase/client'

// Creates a new auth account (owner creating a brand's first admin, or an
// admin creating a staff member) WITHOUT a service-role key. A normal
// supabase.auth.signUp() on the request's own cookie-bound client would
// hijack the CALLER's session into the new account's session — completely
// wrong for "admin adds a teammate". Instead this uses a throwaway,
// non-session-persisting client (a fresh instance, not tied to any
// cookies) so the new account gets created server-side without ever
// touching the calling admin/owner's own session.
export async function createIsolatedUser(params: {
  email: string
  password: string
  full_name: string
  role: 'owner' | 'admin' | 'staff' | 'retailer'
  brand_id: string | null
  phone?: string
}) {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured; cannot create accounts in mock mode')
  }

  const isolatedClient = createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data, error } = await isolatedClient.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.full_name,
        role: params.role,
        brand_id: params.brand_id,
        phone: params.phone,
      },
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('Account creation returned no user')

  return data.user
}

// Short, readable temporary password for accounts I create on someone's
// behalf (owner/staff onboarding). Not meant to be memorized long-term —
// whoever receives it should change it after first login.
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pass = ''
  for (let i = 0; i < 12; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)]
  }
  return pass
}
