import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/api/auth'
import { createIsolatedUser, generateTempPassword } from '@/lib/api/create-user'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAdmin()
    if (!profile.brand_id) {
      return apiError('No brand context', 'FORBIDDEN', 403)
    }
    const supabase = await createServerSupabaseClient()

    const { data: staff, error } = await supabase
      .from('staff_details')
      .select('*, users(id, email, full_name, role, is_active)')
      .eq('brand_id', profile.brand_id)
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch staff', 'DATABASE_ERROR', 500, error)
    }

    return apiSuccess({ staff: staff || [] })

  } catch (error: any) {
    console.error('[ADMIN STAFF API] Error:', error)
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

    const requiredFields = ['email', 'full_name']
    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return apiValidationError([{ field: missingFields[0], message: `${missingFields[0]} is required` }])
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return apiValidationError([{ field: 'email', message: 'Invalid email format' }])
    }

    const payType = body.pay_type === 'hourly' ? 'hourly' : 'salary'
    const payRate = parseFloat(body.pay_rate) || 0

    const tempPassword = generateTempPassword()
    const authUser = await createIsolatedUser({
      email: body.email,
      password: tempPassword,
      full_name: body.full_name,
      role: 'staff',
      brand_id: profile.brand_id,
      phone: body.phone,
    })

    const { data: staffDetails, error: staffError } = await supabase
      .from('staff_details')
      .insert({
        user_id: authUser.id,
        brand_id: profile.brand_id,
        job_title: body.job_title || null,
        pay_type: payType,
        pay_rate: payRate,
        employment_status: 'active',
        hire_date: body.hire_date || new Date().toISOString().slice(0, 10),
      })
      .select()
      .single()

    if (staffError) {
      console.error('[ADMIN STAFF API] Failed to create staff_details row:', staffError)
      return apiError('Staff account was created but employment details failed to save', 'PARTIAL_FAILURE', 500, staffError)
    }

    return apiSuccess({
      staff: staffDetails,
      account: { id: authUser.id, email: body.email, temp_password: tempPassword },
    }, undefined)

  } catch (error: any) {
    console.error('[ADMIN STAFF API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create staff member', 'CREATE_ERROR', 500)
  }
}
