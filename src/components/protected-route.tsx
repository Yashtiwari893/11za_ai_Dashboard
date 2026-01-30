'use client'

/**
 * ProtectedRoute Component - OPTIMIZED FOR SPEED
 * SECURITY: Instant redirect without loading gate
 * - Middleware already redirects unauthenticated users
 * - This is backup protection + role enforcement
 * - Uses immediate redirect, not loading state
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/supabase-provider'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string[]
  fallback?: React.ReactNode
}

export function ProtectedRoute({
  children,
  requiredRole = [],
  fallback = null
}: ProtectedRouteProps) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const checkInProgress = useRef(false)
  const redirected = useRef(false)

  useEffect(() => {
    // Prevent multiple simultaneous checks
    if (checkInProgress.current || redirected.current) return
    checkInProgress.current = true

    // Check authentication and authorization
    const checkAccess = async () => {
      try {
        // Quick session check (from browser cache/memory)
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (!session || !session.user) {
          redirected.current = true
          // Middleware should have caught this, but redirect anyway
          router.push('/login')
          return
        }

        // Only check role if required
        if (requiredRole.length > 0) {
          const { data: userProfile, error } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          if (error || !userProfile) {
            redirected.current = true
            router.push('/login')
            return
          }

          const userRole = userProfile.role

          // Check if user has required role
          if (!requiredRole.includes(userRole)) {
            redirected.current = true
            // Redirect to appropriate dashboard based on user role
            if (userRole === 'super_admin') {
              router.push('/super-admin')
            } else if (userRole === 'admin' || userRole === 'team_admin') {
              router.push('/admin')
            } else {
              router.push('/user')
            }
            return
          }
        }

        // All checks passed - can render children
        // No loading state - instant render
      } catch (error) {
        console.error('[ProtectedRoute] Error checking access:', error)
        redirected.current = true
        router.push('/login')
      } finally {
        checkInProgress.current = false
      }
    }

    checkAccess()
  }, [requiredRole, router, supabase])

  // No loading state - render children immediately
  // Middleware already prevents unauthenticated access at server level
  // This component only does backup checks and role validation
  return <>{children}</>
}

/**
 * Higher-order component for wrapping pages
 * Usage:
 *   export default withProtectedRoute(AdminPage, ['admin', 'super_admin'])
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: string[]
) {
  return function ProtectedPageWrapper(props: P) {
    return (
      <ProtectedRoute requiredRole={requiredRole}>
        <Component {...props} />
      </ProtectedRoute>
    )
  }
}
