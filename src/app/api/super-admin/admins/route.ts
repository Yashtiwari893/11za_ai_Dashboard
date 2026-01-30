/**
 * ============================================
 * GET /api/super-admin/admins
 * PUT /api/super-admin/admins/:adminId
 * DELETE /api/super-admin/admins/:adminId
 * ============================================
 * 
 * Manage admin users (list, update role, delete)
 * Access: SUPER_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireSuperAdmin,
  logTeamAudit,
  createErrorResponse,
  createSuccessResponse,
  UserRole,
} from '@/lib/auth/hierarchical-rbac';

// GET /api/super-admin/admins
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    requireSuperAdmin(auth);

    const supabase = await createClient();

    // Get all admins and team_admins
    const { data: admins, error: adminsError } = await supabase
      .from('user_profiles')
      .select(
        `
        id,
        email,
        full_name,
        role,
        status,
        created_at,
        updated_at,
        team_members (
          team_id,
          role,
          teams:team_id (
            name
          )
        )
      `
      )
      .in('role', ['admin', 'team_admin'])
      .order('created_at', { ascending: false });

    if (adminsError) {
      console.error('[SUPER_ADMIN] Admins fetch error:', adminsError);
      return NextResponse.json(
        createErrorResponse('Failed to fetch admins', 400).body,
        { status: 400 }
      );
    }

    // Format response
    const formattedAdmins = (admins || []).map((admin: any) => ({
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      status: admin.status,
      teams: (admin.team_members || []).map((tm: any) => ({
        teamId: tm.team_id,
        role: tm.role,
        teamName: tm.teams?.name,
      })),
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    }));

    return NextResponse.json(
      createSuccessResponse({
        admins: formattedAdmins,
        total: formattedAdmins.length,
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SUPER_ADMIN] GET /api/super-admin/admins error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('You do not have permission to access this resource', 403)
          .body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}

// PUT and DELETE methods moved to [adminId]/route.ts for dynamic route handling

