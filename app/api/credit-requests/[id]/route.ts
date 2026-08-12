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

    const { data: creditRequest, error: fetchError } = await supabase
      .from('store_credit_history')
      .select('id, store_id, balance_after, transaction_type')
      .eq('id', id)
      .single()

    if (fetchError || !creditRequest) {
      return apiNotFound('Credit request not found')
    }

    if (creditRequest.transaction_type !== 'credit_request_pending') {
      return apiBadRequest('This request has already been resolved')
    }

    if (action === 'approve') {
      const { error: storeUpdateError } = await supabase
        .from('stores')
        .update({ credit_limit: creditRequest.balance_after })
        .eq('id', creditRequest.store_id)

      if (storeUpdateError) {
        console.error('[CREDIT REQUESTS API] Store update error:', storeUpdateError)
        return apiError('Failed to update store credit limit', 'DATABASE_ERROR', 500, storeUpdateError)
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('store_credit_history')
      .update({ transaction_type: action === 'approve' ? 'credit_request_approved' : 'credit_request_rejected' })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[CREDIT REQUESTS API] Update error:', updateError)
      return apiError('Failed to resolve credit request', 'DATABASE_ERROR', 500, updateError)
    }

    return apiSuccess({ request: updated })

  } catch (error: any) {
    console.error('[CREDIT REQUESTS API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
