/**
 * ============================================
 * PUT /api/admin/teams/:teamId/assign-user
 * DELETE /api/admin/teams/:teamId/remove-user
 * ============================================
 * 
 * Assign and remove users from teams
 * Access: SUPER_ADMIN or team admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireTeamAccess,
  logTeamAudit,
  createErrorResponse,
  createSuccessResponse,
  TeamMemberRole,
} from '@/lib/auth/hierarchical-rbac';

type RouteParams = {
  params: Promise<{ teamId: string }>;
};

// PUT /api/admin/teams/:teamId/assign-user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const auth = await requireAuth();

    // Check team access (must be admin or owner in team)
    await requireTeamAccess(auth, teamId, TeamMemberRole.ADMIN);

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        createErrorResponse('Missing required fields: userId, role', 400).body,
        { status: 400 }
      );
    }

    if (!['member', 'admin', 'owner'].includes(role)) {
      return NextResponse.json(
        createErrorResponse('Invalid role. Must be member, admin, or owner', 400).body,
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user exists
    const { data: userExists } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!userExists) {
      return NextResponse.json(
        createErrorResponse('User not found', 404).body,
        { status: 404 }
      );
    }

    // Check if already member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      // Update role
      const { data: updated, error: updateError } = await supabase
        .from('team_members')
        .update({ role })
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .select();

      if (updateError) {
        console.error('[ADMIN] Role update error:', updateError);
        return NextResponse.json(
          createErrorResponse('Failed to update member role', 400).body,
          { status: 400 }
        );
      }

      // Log role change
      await logTeamAudit(
        teamId,
        auth.userId,
        'member_role_changed',
        { role: existingMember.role },
        { role },
        `Changed ${userExists.email} role to ${role}`
      );

      return NextResponse.json(
        createSuccessResponse({
          message: 'Member role updated',
          member: updated?.[0],
        }).body,
        { status: 200 }
      );
    } else {
      // Add new member
      const { data: newMember, error: insertError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: userId,
          role,
        })
        .select();

      if (insertError) {
        console.error('[ADMIN] Member add error:', insertError);
        return NextResponse.json(
          createErrorResponse('Failed to add member', 400).body,
          { status: 400 }
        );
      }

      // Log member addition
      await logTeamAudit(
        teamId,
        auth.userId,
        'member_added',
        {} as any,
        { user_id: userId, role },
        `Added ${userExists.email} to team with role ${role}`
      );

      return NextResponse.json(
        createSuccessResponse({
          message: 'Member added to team',
          member: newMember?.[0],
        }).body,
        { status: 201 }
      );
    }
  } catch (error: any) {
    console.error('[ADMIN] PUT /api/admin/teams/:teamId/assign-user error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('You do not have permission to manage this team', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}

// DELETE /api/admin/teams/:teamId/remove-user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const auth = await requireAuth();

    // Check team access (must be admin or owner)
    await requireTeamAccess(auth, teamId, TeamMemberRole.ADMIN);

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        createErrorResponse('userId is required', 400).body,
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user email for logging
    const { data: user } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    // Remove user from team
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[ADMIN] Member removal error:', deleteError);
      return NextResponse.json(
        createErrorResponse('Failed to remove member', 400).body,
        { status: 400 }
      );
    }

    // Log member removal
    await logTeamAudit(
      teamId,
      auth.userId,
      'member_removed',
      { user_id: userId },
      {} as any,
      `Removed ${user?.email || userId} from team`
    );

    return NextResponse.json(
      createSuccessResponse({
        message: 'Member removed from team',
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN] DELETE /api/admin/teams/:teamId/remove-user error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('You do not have permission to manage this team', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}
