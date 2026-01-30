import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Define protected routes - ALL dashboard routes MUST be here
  const protectedRoutes = [
    '/dashboard',
    '/chat',
    '/files',
    '/settings',
    '/shopify',
    '/ocr',
    '/admin',
    '/user',
    '/super-admin',
    '/live-voice-agent',
    '/calls',
    '/voice',
    '/voice-brain'
  ]

  // Route-to-required-role mapping
  const roleRequiredRoutes: Record<string, string[]> = {
    '/admin': ['admin', 'super_admin'],
    '/super-admin': ['super_admin'],
    '/user': ['user', 'admin', 'team_admin', 'super_admin'],
    '/dashboard': ['user', 'admin', 'team_admin', 'super_admin'],
    '/chat': ['user', 'admin', 'team_admin', 'super_admin'],
    '/files': ['user', 'admin', 'team_admin', 'super_admin'],
    '/settings': ['user', 'admin', 'team_admin', 'super_admin'],
    '/calls': ['user', 'admin', 'team_admin', 'super_admin'],
    '/live-voice-agent': ['admin', 'super_admin'],
    '/voice': ['user', 'admin', 'team_admin', 'super_admin'],
    '/voice-brain': ['admin', 'super_admin']
  }

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // STEP 1: Enforce authentication
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // STEP 2: Enforce role-based access (get user role from database)
  if (isProtectedRoute && user) {
    // Get the required role for this route
    const requiredRole = Object.entries(roleRequiredRoutes).find(
      ([route]) => pathname.startsWith(route)
    )?.[1]

    if (requiredRole) {
      try {
        // Fetch user role from database
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const userRole = userProfile?.role

        // Check if user has required role
        if (userRole && !requiredRole.includes(userRole)) {
          const url = request.nextUrl.clone()
          // Redirect to appropriate dashboard based on their actual role
          if (userRole === 'super_admin') {
            url.pathname = '/super-admin'
          } else if (userRole === 'admin' || userRole === 'team_admin') {
            url.pathname = '/admin'
          } else {
            url.pathname = '/user'
          }
          return NextResponse.redirect(url)
        }
      } catch (error) {
        console.error('[Middleware] Role check error:', error)
        // On error, redirect to login as safety measure
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }
  }

  // Redirect authenticated users away from auth pages
  if ((pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password') && user) {
    const url = request.nextUrl.clone()
    // For authenticated users, redirect to dashboard (role-specific redirect happens in login page)
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Redirect root to dashboard if authenticated, otherwise to login
  if (pathname === '/' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (pathname === '/' && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object
  //    before returning it.

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}