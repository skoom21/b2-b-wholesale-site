import { NextRequest } from 'next/server'
import { createServerSupabaseClient, getCurrentUserProfile } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiForbidden, apiBadRequest } from '@/lib/api/response'

// Records a payment against a store's dues (credit_used). Two entry
// points share this route: an admin/staff logging cash/in-store payment
// on a retailer's behalf, or the retailer logging their own "in-system"
// payment — either way it applies immediately, there's no approval step.
// This intentionally does NOT move real money (no payment processor is
// wired up) — it's a tracked record, same as the rest of the credit ledger.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const profile = await getCurrentUserProfile()
    if (!profile) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const amount = parseFloat(body.amount)
    if (!amount || amount <= 0) {
      return apiBadRequest('amount must be a positive number')
    }
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, brand_id, user_id, credit_used')
      .eq('id', id)
      .single()

    if (storeError || !store) {
      return apiNotFound('Store not found')
    }

    const isOwner = profile.role === 'owner'
    const isAdmin = (profile.role === 'admin' || profile.role === 'staff') && profile.brand_id === store.brand_id
    const isOwnStore = store.user_id === profile.id

    if (!isOwner && !isAdmin && !isOwnStore) {
      return apiForbidden('You do not have permission to record a payment on this store')
    }

    const before = parseFloat(store.credit_used?.toString() || '0')
    const after = Math.round(Math.max(0, before - amount) * 100) / 100

    const { error: updateError } = await supabase
      .from('stores')
      .update({ credit_used: after })
      .eq('id', id)

    if (updateError) {
      return apiError('Failed to record payment', 'DATABASE_ERROR', 500, updateError)
    }

    const { data: entry, error: historyError } = await supabase
      .from('store_credit_history')
      .insert({
        store_id: id,
        amount,
        balance_before: before,
        balance_after: after,
        transaction_type: 'payment',
        reference_type: isOwnStore ? 'in_system' : 'in_store',
        notes,
        created_by: profile.id,
      })
      .select()
      .single()

    if (historyError) {
      console.error('[STORE PAYMENTS API] Failed to log history (payment still applied):', historyError)
    }

    return apiSuccess({ credit_used: after, entry })

  } catch (error: any) {
    console.error('[STORE PAYMENTS API] Error:', error)
    return apiError(error.message || 'Failed to record payment', 'INTERNAL_ERROR', 500)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const profile = await getCurrentUserProfile()
    if (!profile) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    const supabase = await createServerSupabaseClient()

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, brand_id, user_id')
      .eq('id', id)
      .single()

    if (storeError || !store) {
      return apiNotFound('Store not found')
    }

    const isOwner = profile.role === 'owner'
    const isAdmin = (profile.role === 'admin' || profile.role === 'staff') && profile.brand_id === store.brand_id
    const isOwnStore = store.user_id === profile.id

    if (!isOwner && !isAdmin && !isOwnStore) {
      return apiForbidden('You do not have permission to view this store')
    }

    const { data: payments, error } = await supabase
      .from('store_credit_history')
      .select('*')
      .eq('store_id', id)
      .eq('transaction_type', 'payment')
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch payments', 'DATABASE_ERROR', 500, error)
    }

    return apiSuccess({ payments: payments || [] })

  } catch (error: any) {
    console.error('[STORE PAYMENTS API] Error:', error)
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
