/**
 * ============================================
 * ROLE-BASED ACCESS CONTROL (RBAC) UTILITIES
 * ============================================
 * 
 * Provides role-based authorization middleware,
 * type-safe permission checks, and audit logging.
 * 
 * Security: All checks are server-side, validated against database.
 */

import { createClient } from '@/utils/supabase/server';
import { NextRequest } from 'next/server';

/**
 * User Roles Enum
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

/**
 * Permission Matrix for different endpoints
 */
export const PERMISSION_MATRIX = {
  '/api/admin': [UserRole.ADMIN],
  '/api/user/profile': [UserRole.ADMIN, UserRole.USER],
  '/api/user/data': [UserRole.ADMIN, UserRole.USER],
} as const;

/**
 * Auth Context returned by authorization checks
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isAdmin: boolean;
}

/**
 * Get current user's auth context
 * Validates session and retrieves role from database
 * 
 * @returns AuthContext with user info and role, or null if not authenticated
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    
    // Get session from Supabase
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      return null;
    }

    const userId = session.user.id;
    const email = session.user.email || '';

    // Get user profile with role from database
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_active, email')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('[RBAC] User profile not found:', { userId, error: profileError });
      return null;
    }

    const role = userProfile.role as UserRole;
    const isActive = userProfile.is_active;

    return {
      userId,
      email,
      role,
      isActive,
      isAdmin: role === UserRole.ADMIN,
    };
  } catch (error) {
    console.error('[RBAC] Auth context error:', error);
    return null;
  }
}

/**
 * Require authentication middleware
 * Must be called before any role-based checks
 * 
 * @returns AuthContext if authenticated, throws error otherwise
 */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  
  if (!auth) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  if (!auth.isActive) {
    throw new Error('FORBIDDEN: User account is inactive');
  }

  return auth;
}

/**
 * Require admin role
 * 
 * @param auth - AuthContext to check
 * @throws Error if user is not admin
 */
export function requireAdmin(auth: AuthContext): void {
  if (!auth.isAdmin) {
    throw new Error('FORBIDDEN: Admin access required');
  }
}

/**
 * Check if user has access to specific user's data
 * Admin can access any user, regular user can only access themselves
 * 
 * @param auth - Current user's AuthContext
 * @param targetUserId - User ID being accessed
 * @returns true if access allowed, false otherwise
 */
export function canAccessUserData(auth: AuthContext, targetUserId: string): boolean {
  // Admin can access any user
  if (auth.isAdmin) {
    return true;
  }

  // Regular user can only access their own data
  return auth.userId === targetUserId;
}

/**
 * Log audit trail for admin actions
 * 
 * @param action - Action performed (activate, deactivate, role_change, etc.)
 * @param adminId - Admin user performing the action
 * @param targetUserId - User being affected
 * @param oldValues - Previous values (for updates)
 * @param newValues - New values (for updates)
 * @param reason - Reason for the action (optional)
 */
export async function logAuditTrail(
  action: 'activate' | 'deactivate' | 'role_change' | 'data_edit' | 'view',
  adminId: string,
  targetUserId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  reason?: string
): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from('user_audit_log').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action,
      old_values: oldValues || null,
      new_values: newValues || null,
      reason: reason || null,
    });
  } catch (error) {
    console.error('[RBAC] Failed to log audit trail:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

/**
 * Extract user ID from request headers
 * Can be used to validate JWT tokens from custom auth headers
 * 
 * @param request - Next.js request object
 * @returns User ID if found, null otherwise
 */
export function extractUserIdFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  // Token format: Bearer <token>
  // For Supabase JWT, the user ID is in the 'sub' claim
  // This is a helper - actual validation happens via getAuthContext()
  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Check if request path is admin-only
 * 
 * @param path - API path to check
 * @returns true if path requires admin role
 */
export function isAdminOnlyPath(path: string): boolean {
  return path.startsWith('/api/admin');
}

/**
 * Create a standardized error response
 * 
 * @param message - Error message
 * @param status - HTTP status code
 * @returns JSON response with error details
 */
export function createErrorResponse(message: string, status: number) {
  return {
    status,
    body: {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a standardized success response
 * 
 * @param data - Response data
 * @param status - HTTP status code
 * @returns JSON response with success flag
 */
export function createSuccessResponse(data: any, status: number = 200) {
  return {
    status,
    body: {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
  };
}
