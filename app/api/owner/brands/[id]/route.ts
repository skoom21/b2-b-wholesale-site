import { NextRequest } from 'next/server'
import { createServerSupabaseClient, requireOwner } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiValidationError } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data: brand, error } = await supabase
      .from('brands')
      .select('*, brand_subscriptions(*)')
      .eq('id', id)
      .single()

    if (error || !brand) {
      return apiNotFound('Brand not found')
    }

    const { data: staff } = await supabase
      .from('staff_details')
      .select('*, users(id, email, full_name, role)')
      .eq('brand_id', id)

    // The brand's admin account(s) — created up front when the brand was
    // added, not tracked in staff_details (that table is for employment
    // records, not login identity). Surfaced here since it's otherwise
    // impossible to find an admin's login email again after creation.
    const { data: admins } = await supabase
      .from('users')
      .select('id, email, full_name, phone, is_active, last_login_at, created_at')
      .eq('brand_id', id)
      .eq('role', 'admin')
      .order('created_at', { ascending: true })

    const { count: storeCount } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', id)

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', id)

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', id)

    return apiSuccess({
      brand,
      staff: staff || [],
      admins: admins || [],
      counts: { stores: storeCount || 0, products: productCount || 0, orders: orderCount || 0 },
    })

  } catch (error: any) {
    console.error('[OWNER BRAND API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.status !== undefined) {
      if (!['active', 'suspended', 'cancelled'].includes(body.status)) {
        return apiValidationError([{ field: 'status', message: 'Invalid status' }])
      }
      updateData.status = body.status
    }
    if (body.contact_email !== undefined) updateData.contact_email = body.contact_email
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.public_catalog_enabled !== undefined) updateData.public_catalog_enabled = Boolean(body.public_catalog_enabled)
    if (body.public_description !== undefined) updateData.public_description = body.public_description || null
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url || null

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('brands').update(updateData).eq('id', id)
      if (error) throw error
    }

    // Subscription create-or-update (latest row for this brand). Brands
    // created before every brand auto-got a trial row on creation may
    // have no subscription row at all — insert one instead of silently
    // no-op'ing, so setting a plan always works regardless of history.
    if (body.subscription) {
      const { data: latestSub } = await supabase
        .from('brand_subscriptions')
        .select('id')
        .eq('brand_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const subUpdate: any = {}
      const s = body.subscription
      if (s.plan_name !== undefined) subUpdate.plan_name = s.plan_name
      if (s.billing_interval !== undefined) subUpdate.billing_interval = s.billing_interval
      if (s.amount !== undefined) subUpdate.amount = s.amount
      if (s.status !== undefined) subUpdate.status = s.status
      if (s.current_period_end !== undefined) subUpdate.current_period_end = s.current_period_end

      if (Object.keys(subUpdate).length > 0) {
        if (latestSub) {
          await supabase.from('brand_subscriptions').update(subUpdate).eq('id', latestSub.id)
        } else {
          const today = new Date()
          await supabase.from('brand_subscriptions').insert({
            brand_id: id,
            plan_name: subUpdate.plan_name ?? null,
            billing_interval: subUpdate.billing_interval ?? 'monthly',
            amount: subUpdate.amount ?? 0,
            status: subUpdate.status ?? 'active',
            current_period_start: today.toISOString().slice(0, 10),
            current_period_end: subUpdate.current_period_end
              ?? new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          })
        }
      }
    }

    const { data: brand } = await supabase.from('brands').select('*, brand_subscriptions(*)').eq('id', id).single()
    return apiSuccess({ brand })

  } catch (error: any) {
    console.error('[OWNER BRAND API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Failed to update brand', 'UPDATE_ERROR', 500)
  }
}
