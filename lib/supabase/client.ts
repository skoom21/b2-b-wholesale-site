import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../types'

const mockUser = {
  id: 'local-user',
  email: 'local@teetoz.test',
  aud: 'authenticated',
  app_metadata: { provider: 'email', roles: ['authenticated'] },
  user_metadata: { full_name: 'Local User', role: 'retailer' },
  created_at: new Date().toISOString(),
}

const mockSession = {
  access_token: 'local-access-token',
  refresh_token: 'local-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
}

const mockStore = {
  id: 'local-store',
  user_id: mockUser.id,
  name: 'Local Demo Store',
  email: 'store@teetoz.test',
  phone: null,
  store_type: 'retail',
  city: 'Toronto',
  address_line1: '123 Demo Street',
  address_line2: null,
  province: 'ON',
  postal_code: 'M5V 2T6',
  tier: 'standard',
  status: 'active',
  credit_limit: 5000,
  credit_used: 0,
  credit_available: 5000,
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Chainable, awaitable mock query builder. Every filter/modifier method
// (.eq, .order, .limit, .in, ...) returns the same builder so any chain
// shape resolves, and the builder itself is "thenable" so `await`-ing it
// without a terminal .single()/.maybeSingle() call resolves too.
function createMockQueryBuilder(table: string) {
  const singleRecord = table === 'stores' ? mockStore : null
  const listRecord = table === 'stores' && singleRecord ? [singleRecord] : []

  const resolveList = async () => ({ data: listRecord, error: null })

  const builder: any = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    gte: () => builder,
    lte: () => builder,
    gt: () => builder,
    lt: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    contains: () => builder,
    match: () => builder,
    filter: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: async () => ({ data: singleRecord, error: singleRecord ? null : { code: 'PGRST116', message: 'No rows found' } }),
    maybeSingle: async () => ({ data: singleRecord, error: null }),
    insert: (payload: any) => {
      const inserted = Array.isArray(payload) ? payload[0] : payload
      const record = { id: `local-${table}-${Date.now()}`, ...inserted }
      return {
        select: () => ({
          single: async () => ({ data: record, error: null }),
        }),
        single: async () => ({ data: record, error: null }),
      }
    },
    update: (payload: any) => ({
      eq: () => ({
        select: async () => ({ data: [{ ...(singleRecord || {}), ...payload }], error: null }),
      }),
    }),
    delete: () => ({
      eq: async () => ({ data: null, error: null }),
    }),
    then: (onResolve: any, onReject: any) => resolveList().then(onResolve, onReject),
  }

  return builder
}

export function createMockSupabaseClient() {
  return {
    auth: {
      signUp: async () => ({ data: { user: mockUser, session: mockSession }, error: null }),
      signInWithPassword: async () => ({ data: { user: mockUser, session: mockSession }, error: null }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: mockSession }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session: mockSession }, error: null }),
    },
    from: (table: string) => createMockQueryBuilder(table),
  } as any
}

export function createClient() {
  if (!hasSupabaseConfig()) {
    console.warn('[SUPABASE] Missing env vars; using local mock client')
    return createMockSupabaseClient()
  }

  console.log('[SUPABASE CLIENT] Creating browser client')
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
