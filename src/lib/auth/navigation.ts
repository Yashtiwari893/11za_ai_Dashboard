/**
 * ============================================
 * ROLE-BASED NAVIGATION UTILITIES
 * ============================================
 * 
 * Helper functions to determine correct dashboard
 * based on user role
 */

import { createClient } from '@/utils/supabase/server';
import { UserRole } from './rbac';

/**
 * Get user's role for routing decisions
 */
export async function getUserRoleForRouting(): Promise<UserRole | null> {
  try {
    const supabase = await createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return null;
    }

    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !userProfile) {
      return null;
    }

    return userProfile.role as UserRole;
  } catch (error) {
    console.error('[Navigation] Error getting user role:', error);
    return null;
  }
}

/**
 * Get correct dashboard path based on role
 */
export function getDashboardPath(role: UserRole | null): string {
  if (!role) {
    return '/login';
  }

  return role === UserRole.ADMIN ? '/admin' : '/user';
}

/**
 * Check if user should be redirected
 * Call this in client components to ensure user is on correct dashboard
 */
export function getRedirectPath(
  currentPath: string,
  userRole: UserRole | null
): string | null {
  if (!userRole) {
    // Not authenticated
    if (currentPath.startsWith('/admin') || currentPath.startsWith('/user')) {
      return '/login';
    }
    return null;
  }

  // Admin accessing user dashboard
  if (userRole === UserRole.ADMIN && currentPath.startsWith('/user')) {
    return '/admin';
  }

  // User accessing admin dashboard
  if (userRole === UserRole.USER && currentPath.startsWith('/admin')) {
    return '/user';
  }

  return null;
}
