/**
 * ============================================
 * GET /api/super-admin/teams
 * POST /api/super-admin/teams
 * ============================================
 * 
 * Team CRUD operations (SUPER_ADMIN only for POST)
 * GET: List all teams or teams for user
 * POST: Create new team (SUPER_ADMIN only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireSuperAdmin,
  getUserTeams,
  logTeamAudit,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth/hierarchical-rbac';

// GET /api/super-admin/teams
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const supabase = await createClient();

    let query;

    // SUPER_ADMIN gets all teams
    if (auth.isSuperAdmin) {
      query = supabase
        .from('teams')
        .select('*, user_profiles!created_by(email, full_name)')
        .eq('status', 'active');
    } else {
      // Regular admins get only their teams
      query = supabase
        .from('team_members')
        .select('team_id, teams(id, name, description, status, created_by)')
        .eq('user_id', auth.userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SUPER_ADMIN] Error fetching teams:', error);
      return NextResponse.json(
        createErrorResponse('Failed to fetch teams', 400).body,
        { status: 400 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        teams: data || [],
        isSuperAdmin: auth.isSuperAdmin,
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SUPER_ADMIN] GET /api/super-admin/teams error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}

// POST /api/super-admin/teams
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    requireSuperAdmin(auth);

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        createErrorResponse('Team name is required', 400).body,
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Create team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        description: description || null,
        created_by: auth.userId,
        status: 'active',
      })
      .select();

    if (teamError || !teamData?.[0]) {
      console.error('[SUPER_ADMIN] Team creation error:', teamError);
      return NextResponse.json(
        createErrorResponse('Failed to create team', 400).body,
        { status: 400 }
      );
    }

    const team = teamData[0];

    // Add creator as team owner
    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: auth.userId,
      role: 'owner',
    });

    // Log team creation
    await logTeamAudit(
      team.id,
      auth.userId,
      'team_created',
      {} as any,
      {
        id: team.id,
        name,
        description,
      },
      `Created team: ${name}`
    );

    return NextResponse.json(
      createSuccessResponse({
        message: 'Team created successfully',
        team,
      }).body,
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[SUPER_ADMIN] POST /api/super-admin/teams error:', error);

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
