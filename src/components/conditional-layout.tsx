'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import Sidebar from '@/components/sidebar'
import Footer from '@/components/footer'

const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password']

const PROTECTED_ROUTES = [
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

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { supabase } = useSupabase()
  const [checkComplete, setCheckComplete] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  
  // Check if current page is an auth page
  const isAuthPage = AUTH_PAGES.some(page => pathname === page || pathname.startsWith(page + '/'))
  
  // Check if current page is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))

  useEffect(() => {
    if (isAuthPage) {
      // Auth pages don't need protection check
      setCheckComplete(true)
      setIsAuthorized(true)
      return
    }

    if (!isProtectedRoute) {
      // Non-protected pages (like home) can be accessed
      setCheckComplete(true)
      setIsAuthorized(true)
      return
    }

    // Protected route - check auth immediately
    const checkAuth = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (!session || !session.user) {
          // No session - redirect to login IMMEDIATELY
          router.push('/login')
          return
        }

        // Session exists - authorize access
        setIsAuthorized(true)
      } catch (error) {
        console.error('[ConditionalLayout] Auth check error:', error)
        router.push('/login')
      } finally {
        setCheckComplete(true)
      }
    }

    checkAuth()
  }, [pathname, isAuthPage, isProtectedRoute, router, supabase])

  // While checking auth on protected routes, show nothing (transparent redirect)
  if (isProtectedRoute && !checkComplete) {
    return null
  }

  // If auth check failed on protected route, component won't render
  if (isProtectedRoute && !isAuthorized) {
    return null
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen">
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-[#0D163F] dark:via-[#1a1f4a] dark:to-[#2a2f5a]">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-[#0D163F] dark:via-[#1a1f4a] dark:to-[#2a2f5a] lg:ml-0">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}