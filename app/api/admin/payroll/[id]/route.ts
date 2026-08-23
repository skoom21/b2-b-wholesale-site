import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiValidationError } from '@/lib/api/response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin()
    if (!profile.brand_id) {
      return apiError('No brand context', 'FORBIDDEN', 403)
    }
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const validStatuses = ['open', 'processed', 'paid']
    if (!body.status || !validStatuses.includes(body.status)) {
      return apiValidationError([{ field: 'status', message: `status must be one of: ${validStatuses.join(', ')}` }])
    }

    const { data: existing } = await supabase
      .from('payroll_records')
      .select('id')
      .eq('id', id)
      .eq('brand_id', profile.brand_id)
      .single()

    if (!existing) {
      return apiNotFound('Payroll record not found')
    }

    const updateData: any = { status: body.status }
    if (body.status === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    const { data: record, error } = await supabase
      .from('payroll_records')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return apiSuccess({ record })

  } catch (error: any) {
    console.error('[ADMIN PAYROLL API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to update payroll record', 'UPDATE_ERROR', 500)
  }
}
