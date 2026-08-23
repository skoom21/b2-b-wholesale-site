import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireOwner } from '@/lib/api/auth'
import { createIsolatedUser, generateTempPassword } from '@/lib/api/create-user'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    await requireOwner()
    const supabase = await createServerSupabaseClient()

    const { data: brands, error } = await supabase
      .from('brands')
      .select('*, brand_subscriptions(id, plan_name, billing_interval, amount, status, current_period_end)')
      .order('created_at', { ascending: false })

    if (error) {
      return apiError('Failed to fetch brands', 'DATABASE_ERROR', 500, error)
    }

    // Attach a quick store count + primary admin email per brand for the
    // dashboard list. Passwords are never retrievable after creation
    // (they're hashed) — this is just the login identifier so the owner
    // can find/contact the right admin without re-reading old chat logs.
    const brandsWithCounts = await Promise.all(
      (brands || []).map(async (brand: any) => {
        const { count: storeCount } = await supabase
          .from('stores')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brand.id)
        const { data: admin } = await supabase
          .from('users')
          .select('email')
          .eq('brand_id', brand.id)
          .eq('role', 'admin')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        return { ...brand, store_count: storeCount || 0, admin_email: admin?.email || null }
      })
    )

    return apiSuccess({ brands: brandsWithCounts })

  } catch (error: any) {
    console.error('[OWNER BRANDS API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner()
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const requiredFields = ['name', 'slug', 'admin_email', 'admin_full_name']
    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return apiValidationError([{ field: missingFields[0], message: `${missingFields[0]} is required` }])
    }

    const slug = String(body.slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-')

    const { data: existing } = await supabase.from('brands').select('id').eq('slug', slug).single()
    if (existing) {
      return apiValidationError([{ field: 'slug', message: 'A brand with this slug already exists' }])
    }

    // Create the brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert({
        name: body.name,
        slug,
        status: 'active',
        contact_email: body.contact_email || body.admin_email,
        contact_phone: body.contact_phone || null,
        notes: body.notes || null,
      })
      .select()
      .single()

    if (brandError || !brand) {
      return apiError('Failed to create brand', 'DATABASE_ERROR', 500, brandError)
    }

    // Optional starter subscription record (tracked only, no processor)
    if (body.plan_name) {
      await supabase.from('brand_subscriptions').insert({
        brand_id: brand.id,
        plan_name: body.plan_name,
        billing_interval: body.billing_interval || 'monthly',
        amount: body.amount || 0,
        status: 'trialing',
      })
    }

    // Create the brand's first admin account. Isolated signUp so it
    // never touches the owner's own session.
    const tempPassword = generateTempPassword()
    let adminAccount: { id: string; email: string; temp_password: string } | null = null
    try {
      const authUser = await createIsolatedUser({
        email: body.admin_email,
        password: tempPassword,
        full_name: body.admin_full_name,
        role: 'admin',
        brand_id: brand.id,
      })
      adminAccount = { id: authUser.id, email: body.admin_email, temp_password: tempPassword }
    } catch (createUserError: any) {
      console.error('[OWNER BRANDS API] Failed to create brand admin account:', createUserError)
      // Brand itself was created successfully; surface the admin-account
      // failure separately so the owner can retry just that part.
      return apiSuccess({
        brand,
        admin_account: null,
        admin_account_error: createUserError.message || 'Failed to create admin account',
      }, undefined)
    }

    return apiSuccess({ brand, admin_account: adminAccount })

  } catch (error: any) {
    console.error('[OWNER BRANDS API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to create brand', 'CREATE_ERROR', 500)
  }
}
