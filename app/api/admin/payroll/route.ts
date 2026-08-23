import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { apiSuccess, apiError, apiValidationError, apiNotFound } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAdmin()
    if (!profile.brand_id) {
      return apiError('No brand context', 'FORBIDDEN', 403)
    }
    const supabase = await createServerSupabaseClient()
    const staffId = request.nextUrl.searchParams.get('staff_id')

    let query = supabase
      .from('payroll_records')
      .select('*, staff_details(id, job_title, users(id, full_name, email))')
      .eq('brand_id', profile.brand_id)
      .order('period_start', { ascending: false })

    if (staffId) {
      query = query.eq('staff_id', staffId)
    }

    const { data: records, error } = await query
    if (error) {
      return apiError('Failed to fetch payroll records', 'DATABASE_ERROR', 500, error)
    }

    return apiSuccess({ records: records || [] })

  } catch (error: any) {
    console.error('[ADMIN PAYROLL API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAdmin()
    if (!profile.brand_id) {
      return apiError('No brand context', 'FORBIDDEN', 403)
    }
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const requiredFields = ['staff_id', 'period_start', 'period_end', 'gross_amount']
    const missingFields = requiredFields.filter(field => body[field] === undefined || body[field] === null)
    if (missingFields.length > 0) {
      return apiValidationError([{ field: missingFields[0], message: `${missingFields[0]} is required` }])
    }

    // Confirm the staff member belongs to this admin's brand
    const { data: staff } = await supabase
      .from('staff_details')
      .select('id')
      .eq('id', body.staff_id)
      .eq('brand_id', profile.brand_id)
      .single()

    if (!staff) {
      return apiNotFound('Staff member not found')
    }

    const grossAmount = parseFloat(body.gross_amount)
    const deductions = parseFloat(body.deductions || 0)
    const netAmount = grossAmount - deductions

    const { data: record, error } = await supabase
      .from('payroll_records')
      .insert({
        staff_id: body.staff_id,
        brand_id: profile.brand_id,
        period_start: body.period_start,
        period_end: body.period_end,
        gross_amount: grossAmount,
        deductions,
        net_amount: netAmount,
        status: 'open',
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return apiSuccess({ record }, undefined)

  } catch (error: any) {
    console.error('[ADMIN PAYROLL API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create payroll record', 'CREATE_ERROR', 500)
  }
}
