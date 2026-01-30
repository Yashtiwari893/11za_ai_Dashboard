/**
 * ============================================
 * GET /api/admin/teams/:teamId/members
 * ============================================
 * 
 * Get all members of a team with their roles
 * Access: Team member (any role)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireTeamAccess,
  createErrorResponse,
  createSuccessResponse,
  TeamMemberRole,
} from '@/lib/auth/hierarchical-rbac';

type RouteParams = {
  params: Promise<{ teamId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const auth = await requireAuth();

    // Check team access (any role is fine for viewing)
    await requireTeamAccess(auth, teamId, TeamMemberRole.MEMBER);

    const supabase = await createClient();

    // Get all team members with user details
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(
        `
        id,
        role,
        created_at,
        user_profiles:user_id (
          id,
          email,
          full_name,
          role
        )
      `
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (membersError) {
      console.error('[ADMIN] Members fetch error:', membersError);
      return NextResponse.json(
        createErrorResponse('Failed to fetch team members', 400).body,
        { status: 400 }
      );
    }

    // Format response
    const formattedMembers = (members || []).map((member: any) => ({
      id: member.id,
      userId: member.user_profiles?.id,
      email: member.user_profiles?.email,
      fullName: member.user_profiles?.full_name,
      userRole: member.user_profiles?.role,
      teamRole: member.role,
      joinedAt: member.created_at,
    }));

    return NextResponse.json(
      createSuccessResponse({
        teamId,
        members: formattedMembers,
        total: formattedMembers.length,
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN] GET /api/admin/teams/:teamId/members error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('You do not have permission to view this team', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}
