/**
 * ============================================
 * HIERARCHICAL ROLE & TEAM AUTHORIZATION
 * ============================================
 * 
 * Implements role hierarchy:
 * - SUPER_ADMIN: Full system access + can create admins + manage all teams
 * - ADMIN: Can manage their team's users and data
 * - USER: Can access only their own data
 * 
 * Team-based authorization:
 * - Checks if user belongs to team
 * - Validates role within team
 * - Enforces team data isolation
 */

import { createClient } from '@/utils/supabase/server';

/**
 * User Roles (Hierarchical)
 * SUPER_ADMIN > ADMIN > USER
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  TEAM_ADMIN = 'team_admin',
  USER = 'user',
}

/**
 * Team Member Roles
 */
export enum TeamMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

/**
 * Auth context with role hierarchy
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  teams?: string[]; // Team IDs user belongs to
}

/**
 * Team context for authorization
 */
export interface TeamContext {
  teamId: string;
  teamName: string;
  userRole: TeamMemberRole;
  canManage: boolean;
}

/**
 * Get current user's auth context with full role information
 * 
 * @returns AuthContext with user info and role hierarchy
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();

    // Get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      return null;
    }

    const userId = session.user.id;
    const email = session.user.email || '';

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_active, email')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('[HIERARCHICAL_RBAC] User profile not found:', {
        userId,
        error: profileError,
      });
      return null;
    }

    const role = userProfile.role as UserRole;
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const isAdmin = role === UserRole.ADMIN || role === UserRole.TEAM_ADMIN;

    // Get user's teams (if not SUPER_ADMIN)
    let teams: string[] = [];
    if (!isSuperAdmin) {
      const { data: teamData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId);

      teams = teamData?.map((t) => t.team_id) || [];
    }

    return {
      userId,
      email,
      role,
      isActive: userProfile.is_active,
      isSuperAdmin,
      isAdmin,
      teams,
    };
  } catch (error) {
    console.error('[HIERARCHICAL_RBAC] Auth context error:', error);
    return null;
  }
}

/**
 * Require authentication
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
 * Require SUPER_ADMIN role
 */
export function requireSuperAdmin(auth: AuthContext): void {
  if (!auth.isSuperAdmin) {
    throw new Error('FORBIDDEN: Super admin access required');
  }
}

/**
 * Require ADMIN or SUPER_ADMIN role
 */
export function requireAdmin(auth: AuthContext): void {
  if (!auth.isAdmin && !auth.isSuperAdmin) {
    throw new Error('FORBIDDEN: Admin access required');
  }
}

/**
 * Get user's role in specific team
 * 
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns TeamMemberRole or null if not member
 */
export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamMemberRole | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.role as TeamMemberRole;
  } catch (error) {
    console.error('[HIERARCHICAL_RBAC] Error getting team role:', error);
    return null;
  }
}

/**
 * Check if user can manage a team
 * SUPER_ADMIN or team owner/admin
 * 
 * @param auth - AuthContext
 * @param teamId - Team ID to check access
 * @returns true if user can manage team
 */
export async function canManageTeam(auth: AuthContext, teamId: string): Promise<boolean> {
  // SUPER_ADMIN can manage any team
  if (auth.isSuperAdmin) {
    return true;
  }

  // Check if user is team owner or admin
  const teamRole = await getUserTeamRole(auth.userId, teamId);
  return teamRole === TeamMemberRole.OWNER || teamRole === TeamMemberRole.ADMIN;
}

/**
 * Require team access and optional role level
 * 
 * @param auth - AuthContext
 * @param teamId - Team ID to access
 * @param minRole - Minimum role required (member, admin, owner)
 * @throws Error if access denied
 */
export async function requireTeamAccess(
  auth: AuthContext,
  teamId: string,
  minRole: TeamMemberRole = TeamMemberRole.MEMBER
): Promise<TeamMemberRole> {
  // SUPER_ADMIN always has access
  if (auth.isSuperAdmin) {
    return TeamMemberRole.OWNER;
  }

  // Check if user is member of team
  const teamRole = await getUserTeamRole(auth.userId, teamId);

  if (!teamRole) {
    throw new Error('FORBIDDEN: You are not a member of this team');
  }

  // Check minimum role requirement
  const roleHierarchy: Record<TeamMemberRole, number> = {
    [TeamMemberRole.MEMBER]: 1,
    [TeamMemberRole.ADMIN]: 2,
    [TeamMemberRole.OWNER]: 3,
  };

  if (roleHierarchy[teamRole] < roleHierarchy[minRole]) {
    throw new Error(`FORBIDDEN: Insufficient team role (require ${minRole})`);
  }

  return teamRole;
}

/**
 * Get all teams for a user
 */
export async function getUserTeams(userId: string): Promise<TeamContext[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, teams(name), role')
      .eq('user_id', userId);

    if (error || !data) {
      return [];
    }

    return data.map((tm: any) => ({
      teamId: tm.team_id,
      teamName: tm.teams?.name || 'Unknown',
      userRole: tm.role as TeamMemberRole,
      canManage: tm.role === TeamMemberRole.OWNER || tm.role === TeamMemberRole.ADMIN,
    }));
  } catch (error) {
    console.error('[HIERARCHICAL_RBAC] Error getting user teams:', error);
    return [];
  }
}

/**
 * Get all members of a team
 * Only accessible to team members or SUPER_ADMIN
 */
export async function getTeamMembers(
  teamId: string,
  auth: AuthContext
): Promise<any[]> {
  try {
    // Check access first
    await requireTeamAccess(auth, teamId, TeamMemberRole.MEMBER);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, user_profiles(email, full_name), role, joined_at')
      .eq('team_id', teamId);

    if (error) {
      console.error('[HIERARCHICAL_RBAC] Error getting team members:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[HIERARCHICAL_RBAC] Error in getTeamMembers:', error);
    throw error;
  }
}

/**
 * Log team audit action
 */
export async function logTeamAudit(
  teamId: string,
  adminId: string,
  action: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  reason?: string
): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from('team_audit_log').insert({
      team_id: teamId,
      admin_id: adminId,
      action,
      old_values: oldValues || null,
      new_values: newValues || null,
      reason: reason || null,
    });
  } catch (error) {
    console.error('[HIERARCHICAL_RBAC] Failed to log team audit:', error);
    // Don't throw - audit logging failure shouldn't break main operation
  }
}

/**
 * Create standardized error response
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
 * Create standardized success response
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
