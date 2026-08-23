import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api/response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const action = body.action
    if (action !== 'approve' && action !== 'reject') {
      return apiBadRequest('action must be "approve" or "reject"')
    }

    const { data: modelRequest, error: fetchError } = await supabase
      .from('payment_model_requests')
      .select('id, store_id, requested_model, requested_billing_frequency, status, stores(brand_id)')
      .eq('id', id)
      .single()

    if (fetchError || !modelRequest) {
      return apiNotFound('Payment model request not found')
    }

    if ((modelRequest.stores as any)?.brand_id !== admin.brand_id) {
      return apiError('This request belongs to a different brand', 'FORBIDDEN', 403)
    }

    if (modelRequest.status !== 'pending') {
      return apiBadRequest('This request has already been resolved')
    }

    if (action === 'approve') {
      const { error: storeUpdateError } = await supabase
        .from('stores')
        .update({
          payment_model: modelRequest.requested_model,
          billing_frequency: modelRequest.requested_model === 'subscription' ? modelRequest.requested_billing_frequency : null,
          next_billing_date: modelRequest.requested_model === 'subscription'
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            : null,
        })
        .eq('id', modelRequest.store_id)

      if (storeUpdateError) {
        console.error('[PAYMENT MODEL REQUESTS API] Store update error:', storeUpdateError)
        return apiError('Failed to update store payment model', 'DATABASE_ERROR', 500, storeUpdateError)
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('payment_model_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        resolved_by: admin.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[PAYMENT MODEL REQUESTS API] Update error:', updateError)
      return apiError('Failed to resolve request', 'DATABASE_ERROR', 500, updateError)
    }

    return apiSuccess({ request: updated })

  } catch (error: any) {
    console.error('[PAYMENT MODEL REQUESTS API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
