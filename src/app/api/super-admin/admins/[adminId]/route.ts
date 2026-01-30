/**
 * ============================================
 * PUT /api/super-admin/admins/[adminId]
 * DELETE /api/super-admin/admins/[adminId]
 * ============================================
 * 
 * Update or delete a specific admin user
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

type RouteParams = {
  params: Promise<{ adminId: string }>;
};

// PUT /api/super-admin/admins/[adminId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { adminId } = await params;
    const auth = await requireAuth();
    requireSuperAdmin(auth);

    const body = await request.json();
    const { role, status } = body;

    // Validate inputs
    if (role && !['admin', 'team_admin', 'user'].includes(role)) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid role. Must be admin, team_admin, or user',
          400
        ).body,
        { status: 400 }
      );
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        createErrorResponse('Invalid status. Must be active or inactive', 400).body,
        { status: 400 }
      );
    }

    if (!role && !status) {
      return NextResponse.json(
        createErrorResponse('Must provide role or status to update', 400).body,
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current admin for logging
    const { data: currentAdmin } = await supabase
      .from('user_profiles')
      .select('id, email, role, status')
      .eq('id', adminId)
      .single();

    if (!currentAdmin) {
      return NextResponse.json(
        createErrorResponse('Admin not found', 404).body,
        { status: 404 }
      );
    }

    // Update admin
    const updateData: any = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', adminId)
      .select();

    if (updateError) {
      console.error('[SUPER_ADMIN] Admin update error:', updateError);
      return NextResponse.json(
        createErrorResponse('Failed to update admin', 400).body,
        { status: 400 }
      );
    }

    // Log the change
    await logTeamAudit(
      'system', // Use 'system' for system-wide changes
      auth.userId,
      'admin_updated',
      currentAdmin,
      updated?.[0],
      `Updated admin ${currentAdmin.email}: ${role ? `role changed to ${role}` : ''} ${status ? `status changed to ${status}` : ''}`
    );

    return NextResponse.json(
      createSuccessResponse({
        message: 'Admin updated',
        admin: updated?.[0],
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SUPER_ADMIN] PUT /api/super-admin/admins/[adminId] error:', error);

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

// DELETE /api/super-admin/admins/[adminId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { adminId } = await params;
    const auth = await requireAuth();
    requireSuperAdmin(auth);

    // Prevent self-deletion
    if (adminId === auth.userId) {
      return NextResponse.json(
        createErrorResponse('Cannot delete your own admin account', 400).body,
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get admin details for logging
    const { data: admin } = await supabase
      .from('user_profiles')
      .select('id, email, role, status')
      .eq('id', adminId)
      .single();

    if (!admin) {
      return NextResponse.json(
        createErrorResponse('Admin not found', 404).body,
        { status: 404 }
      );
    }

    // Soft delete: set role to 'user' and status to 'inactive'
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        role: UserRole.USER,
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);

    if (updateError) {
      console.error('[SUPER_ADMIN] Admin deletion error:', updateError);
      return NextResponse.json(
        createErrorResponse('Failed to delete admin', 400).body,
        { status: 400 }
      );
    }

    // Remove from all teams
    const { error: memberDeleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', adminId);

    if (memberDeleteError) {
      console.error('[SUPER_ADMIN] Error removing admin from teams:', memberDeleteError);
      // Don't fail the whole operation if team member deletion fails
    }

    // Log the deletion
    await logTeamAudit(
      'system',
      auth.userId,
      'admin_deleted',
      admin,
      {} as any,
      `Deleted admin ${admin.email}`
    );

    return NextResponse.json(
      createSuccessResponse({
        message: 'Admin account deactivated',
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SUPER_ADMIN] DELETE /api/super-admin/admins/[adminId] error:', error);

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
