/**
 * ============================================
 * POST /api/super-admin/create-admin
 * ============================================
 * 
 * SUPER_ADMIN only endpoint to create new admins
 * 
 * Request body:
 * {
 *   email: string,
 *   password: string,
 *   full_name: string,
 *   phone_number?: string,
 *   role: 'admin' | 'team_admin',
 *   teams?: string[] (team IDs to assign)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireSuperAdmin,
  logTeamAudit,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth/hierarchical-rbac';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify SUPER_ADMIN access
    const auth = await requireAuth();
    requireSuperAdmin(auth);

    // Step 2: Parse request body
    const body = await request.json();
    const { email, password, full_name, phone_number, role, teams: teamIds } = body;

    // Step 3: Validate required fields
    if (!email || !password || !full_name) {
      return NextResponse.json(
        createErrorResponse('Missing required fields: email, password, full_name', 400).body,
        { status: 400 }
      );
    }

    if (!['admin', 'team_admin'].includes(role)) {
      return NextResponse.json(
        createErrorResponse('Invalid role. Must be admin or team_admin', 400).body,
        { status: 400 }
      );
    }

    // Step 4: Check if user already exists
    const supabase = await createClient();

    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        createErrorResponse('User with this email already exists', 400).body,
        { status: 400 }
      );
    }

    // Step 5: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (authError || !authData?.user) {
      console.error('[SUPER_ADMIN] Auth user creation error:', authError);
      return NextResponse.json(
        createErrorResponse('Failed to create user', 400).body,
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // Step 6: Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUserId,
        email: email.toLowerCase(),
        full_name,
        phone_number: phone_number || null,
        role,
        is_active: true,
        is_verified_email: true,
      })
      .select();

    if (profileError) {
      console.error('[SUPER_ADMIN] Profile creation error:', profileError);
      // Cleanup: Delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        createErrorResponse('Failed to create user profile', 400).body,
        { status: 400 }
      );
    }

    // Step 7: Assign teams if provided
    if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
      // Validate teams exist
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .in('id', teamIds);

      if (teamsError || !teams || teams.length !== teamIds.length) {
        return NextResponse.json(
          createErrorResponse('One or more team IDs are invalid', 400).body,
          { status: 400 }
        );
      }

      // Add user to teams
      const teamMemberships = teamIds.map((teamId) => ({
        team_id: teamId,
        user_id: newUserId,
        role: 'admin', // New admins are admin in assigned teams
      }));

      const { error: memberError } = await supabase
        .from('team_members')
        .insert(teamMemberships);

      if (memberError) {
        console.error('[SUPER_ADMIN] Team assignment error:', memberError);
        return NextResponse.json(
          createErrorResponse('Failed to assign teams', 400).body,
          { status: 400 }
        );
      }

      // Log for each team assignment
      for (const teamId of teamIds) {
        await logTeamAudit(
          teamId,
          auth.userId,
          'member_added',
          {} as any,
          { user_id: newUserId, role: 'admin' },
          `New admin ${email} assigned to team`
        );
      }
    }

    // Step 8: Log admin creation
    await logTeamAudit(
      '', // No specific team for system-wide admin creation
      auth.userId,
      'admin_created',
      {} as any,
      {
        user_id: newUserId,
        email,
        full_name,
        role,
        teams: teamIds,
      },
      `Created new ${role}: ${email}`
    );

    return NextResponse.json(
      createSuccessResponse({
        message: 'Admin created successfully',
        user: {
          id: newUserId,
          email: email.toLowerCase(),
          full_name,
          role,
          teams: teamIds || [],
        },
      }).body,
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[SUPER_ADMIN] POST /api/super-admin/create-admin error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('Super admin access required', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}
