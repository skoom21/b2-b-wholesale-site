import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireOwner } from '@/lib/api/auth'
import { createIsolatedUser, generateTempPassword } from '@/lib/api/create-user'
import { apiSuccess, apiError, apiNotFound, apiValidationError } from '@/lib/api/response'

// Adds an admin account to a brand that doesn't have one yet — the retry
// path for when the admin account creation during POST /api/owner/brands
// failed (duplicate email, an email domain Supabase's validator rejects,
// etc.) and left the brand with no way to log in.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    if (!body.email || !body.full_name) {
      return apiValidationError([{ field: !body.email ? 'email' : 'full_name', message: 'Required' }])
    }

    const { data: brand } = await supabase.from('brands').select('id').eq('id', id).single()
    if (!brand) {
      return apiNotFound('Brand not found')
    }

    const tempPassword = generateTempPassword()
    const authUser = await createIsolatedUser({
      email: body.email,
      password: tempPassword,
      full_name: body.full_name,
      role: 'admin',
      brand_id: id,
    })

    return apiSuccess({ admin_account: { id: authUser.id, email: body.email, temp_password: tempPassword } })

  } catch (error: any) {
    console.error('[OWNER BRAND ADMIN API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create admin account', 'CREATE_ERROR', 500)
  }
}
