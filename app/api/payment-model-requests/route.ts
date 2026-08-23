import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAuth, getUserRole } from '@/lib/api/auth'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api/response'

const VALID_MODELS = ['credit', 'per_order', 'subscription']
const VALID_FREQUENCIES = ['weekly', 'biweekly', 'monthly']

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const role = getUserRole(user)

    if (role === 'admin' || role === 'staff' || role === 'owner') {
      const { data, error } = await supabase
        .from('payment_model_requests')
        .select('*, stores(id, name, email, payment_model)')
        .order('created_at', { ascending: false })

      if (error) {
        return apiError('Failed to fetch payment model requests', 'DATABASE_ERROR', 500, error)
      }
      return apiSuccess({ requests: data || [] })
    }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!store) {
      return apiNotFound('Store not found for user')
    }

    const { data, error } = await supabase
      .from('payment_model_requests')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch payment model requests', 'DATABASE_ERROR', 500, error)
    }
    return apiSuccess({ requests: data || [] })

  } catch (error: any) {
    console.error('[PAYMENT MODEL REQUESTS API] Error:', error)
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

    const requestedModel = body.requested_model
    if (!VALID_MODELS.includes(requestedModel)) {
      return apiBadRequest('requested_model must be one of: credit, per_order, subscription')
    }

    const requestedFrequency = body.requested_billing_frequency
    if (requestedModel === 'subscription' && !VALID_FREQUENCIES.includes(requestedFrequency)) {
      return apiBadRequest('requested_billing_frequency is required for subscription and must be one of: weekly, biweekly, monthly')
    }

    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, payment_model')
      .eq('user_id', user.id)
      .single()

    if (storeError || !store) {
      return apiNotFound('Store not found for user')
    }

    if (requestedModel === store.payment_model) {
      return apiBadRequest(`You're already on the ${requestedModel} model`)
    }

    const { data: existingPending } = await supabase
      .from('payment_model_requests')
      .select('id')
      .eq('store_id', store.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPending) {
      return apiBadRequest('You already have a pending payment model request. Wait for it to be reviewed before submitting another.')
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('payment_model_requests')
      .insert({
        store_id: store.id,
        current_model: store.payment_model,
        requested_model: requestedModel,
        requested_billing_frequency: requestedModel === 'subscription' ? requestedFrequency : null,
        reason,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[PAYMENT MODEL REQUESTS API] Insert error:', insertError)
      return apiError('Failed to submit request', 'DATABASE_ERROR', 500, insertError)
    }

    return apiSuccess({ request: newRequest })

  } catch (error: any) {
    console.error('[PAYMENT MODEL REQUESTS API] Error:', error)
    if (error.message === 'Unauthorized') {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
