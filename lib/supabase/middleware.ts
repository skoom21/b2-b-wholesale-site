import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasSupabaseConfig } from './client'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log('[MIDDLEWARE] Request to:', pathname)

  let supabaseResponse = NextResponse.next({
    request,
  })

  const cookies = request.cookies.getAll()
  console.log('[MIDDLEWARE] Cookies received:', cookies.map(c => c.name))

  if (!hasSupabaseConfig()) {
    console.warn('[MIDDLEWARE] Missing Supabase config; skipping auth checks')
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          console.log('[MIDDLEWARE] Setting cookies:', cookiesToSet.map(c => c.name))
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  console.log('[MIDDLEWARE] Calling getUser...')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  console.log('[MIDDLEWARE] getUser result:', { hasUser: !!user, userId: user?.id, role: user?.user_metadata?.role })

  const dashboardPathForRole = (role: string) =>
    role === 'owner' ? '/owner/dashboard' :
    (role === 'admin' || role === 'staff' || role === 'manager') ? '/admin/dashboard' :
    '/retailer/dashboard'

  // Redirect authenticated users away from login/register pages to their dashboard
  if (
    user &&
    (request.nextUrl.pathname.startsWith('/login') ||
     request.nextUrl.pathname.startsWith('/register'))
  ) {
    const role = user.user_metadata?.role || 'retailer'
    const dashboardPath = dashboardPathForRole(role)
    console.log('[MIDDLEWARE] Authenticated user on auth page, redirecting to', dashboardPath)
    const url = request.nextUrl.clone()
    url.pathname = dashboardPath
    return NextResponse.redirect(url)
  }

  // Check role-based access
  if (user) {
    const role = user.user_metadata?.role || 'retailer'
    const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
    const isRetailerPath = request.nextUrl.pathname.startsWith('/retailer')
    const isOwnerPath = request.nextUrl.pathname.startsWith('/owner')
    const isOwner = role === 'owner'
    const isAdminLike = role === 'admin' || role === 'staff' || role === 'manager'
    const isRetailer = !isOwner && !isAdminLike

    // Owner trying to access admin/retailer routes, or anyone non-owner on owner routes
    if ((isOwner && (isAdminPath || isRetailerPath)) || (!isOwner && isOwnerPath)) {
      const dashboardPath = dashboardPathForRole(role)
      console.log('[MIDDLEWARE] Wrong-role route access, redirecting to', dashboardPath)
      const url = request.nextUrl.clone()
      url.pathname = dashboardPath
      return NextResponse.redirect(url)
    }

    // Admin/staff trying to access retailer routes
    if (isAdminLike && isRetailerPath) {
      console.log('[MIDDLEWARE] Admin user on retailer route, redirecting to /admin/dashboard')
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
    }

    // Retailer trying to access admin routes
    if (isRetailer && isAdminPath) {
      console.log('[MIDDLEWARE] Retailer user on admin route, redirecting to /retailer/dashboard')
      const url = request.nextUrl.clone()
      url.pathname = '/retailer/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Redirect unauthenticated users to login (except for public routes)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/reset-password') &&
    request.nextUrl.pathname !== '/'
  ) {
    console.log('[MIDDLEWARE] No user found, redirecting to /login')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    console.log('[MIDDLEWARE] User authenticated:', user.id, 'role:', user.user_metadata?.role || 'retailer')
  }

  return supabaseResponse
}
