import { requireAdmin, createServerSupabaseClient } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

// Read-only: a brand admin/staff viewing their own brand's subscription.
// Only the platform owner can change pricing/status (PATCH /api/owner/brands/[id]).
export async function GET() {
  try {
    const profile = await requireAdmin()
    const supabase = await createServerSupabaseClient()

    const { data: subscription, error } = await supabase
      .from('brand_subscriptions')
      .select('*')
      .eq('brand_id', profile.brand_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return apiError('Failed to fetch subscription', 'DATABASE_ERROR', 500, error)
    }

    return apiSuccess({ subscription: subscription || null })

  } catch (error: any) {
    console.error('[ADMIN SUBSCRIPTION API] Error:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return apiError(error.message, error.message.includes('Forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
        error.message.includes('Forbidden') ? 403 : 401)
    }
    return apiError(error.message || 'Internal server error', 'INTERNAL_ERROR', 500)
  }
}
