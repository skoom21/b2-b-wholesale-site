import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth, getUserRole } from '@/lib/api/auth'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = getUserRole(user)

    if (role === 'admin' || role === 'staff' || role === 'owner') {
      const { data, error } = await supabase
        .from('store_credit_history')
        .select('id, store_id, amount, balance_before, balance_after, transaction_type, notes, created_at, stores(id, name, email, credit_limit)')
        .in('transaction_type', ['credit_request_pending', 'credit_request_approved', 'credit_request_rejected'])
        .order('created_at', { ascending: false })

      if (error) {
        return apiError('Failed to fetch credit requests', 'DATABASE_ERROR', 500, error)
      }
      return apiSuccess({ requests: data || [] })
    }

    // Retailer: only their own store's requests
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!store) {
      return apiNotFound('Store not found for user')
    }

    const { data, error } = await supabase
      .from('store_credit_history')
      .select('id, amount, balance_before, balance_after, transaction_type, notes, created_at')
      .eq('store_id', store.id)
      .in('transaction_type', ['credit_request_pending', 'credit_request_approved', 'credit_request_rejected'])
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch credit requests', 'DATABASE_ERROR', 500, error)
    }
    return apiSuccess({ requests: data || [] })

  } catch (error: any) {
    console.error('[CREDIT REQUESTS API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const requestedLimit = parseFloat(body.requested_limit)
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null

    if (!requestedLimit || requestedLimit <= 0) {
      return apiBadRequest('requested_limit must be a positive number')
    }

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, credit_limit')
      .eq('user_id', user.id)
      .single()

    if (storeError || !store) {
      return apiNotFound('Store not found for user')
    }

    const currentLimit = parseFloat(store.credit_limit?.toString() || '0')

    if (requestedLimit <= currentLimit) {
      return apiBadRequest(`Requested limit must be higher than your current limit of $${currentLimit.toFixed(2)}`)
    }

    const { data: existingPending } = await supabase
      .from('store_credit_history')
      .select('id')
      .eq('store_id', store.id)
      .eq('transaction_type', 'credit_request_pending')
      .maybeSingle()

    if (existingPending) {
      return apiBadRequest('You already have a pending credit request. Wait for it to be reviewed before submitting another.')
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('store_credit_history')
      .insert({
        store_id: store.id,
        amount: requestedLimit - currentLimit,
        balance_before: currentLimit,
        balance_after: requestedLimit,
        transaction_type: 'credit_request_pending',
        notes: reason,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[CREDIT REQUESTS API] Insert error:', insertError)
      return apiError('Failed to submit credit request', 'DATABASE_ERROR', 500, insertError)
    }

    return apiSuccess({ request: newRequest })

  } catch (error: any) {
    console.error('[CREDIT REQUESTS API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
