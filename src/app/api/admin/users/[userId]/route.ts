/**
 * ============================================
 * GET /api/admin/users/[userId]
 * POST /api/admin/users/[userId]
 * ============================================
 * 
 * Admin endpoint to view and update specific user
 * 
 * GET: View user details
 * POST: Update user data (email, name, role, status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireAdmin,
  canAccessUserData,
  logAuditTrail,
  createErrorResponse,
  createSuccessResponse,
  UserRole,
} from '@/lib/auth/rbac';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: targetUserId } = await params;

    // Step 1: Authenticate and verify admin role
    const auth = await requireAuth();
    requireAdmin(auth);

    // Step 2: Fetch user profile
    const supabase = await createClient();
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        createErrorResponse('User not found', 404).body,
        { status: 404 }
      );
    }

    // Step 3: Log audit trail (view action)
    await logAuditTrail('view', auth.userId, targetUserId);

    return NextResponse.json(
      createSuccessResponse(user).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN] GET /api/admin/users/[userId] error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('Admin access required', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: targetUserId } = await params;

    // Step 1: Authenticate and verify admin role
    const auth = await requireAuth();
    requireAdmin(auth);

    // Step 2: Parse request body
    const body = await request.json();
    const { full_name, phone_number, role, is_active, reason } = body;

    // Validation: Only allow updating specific fields
    if (!full_name && !phone_number && role === undefined && is_active === undefined) {
      return NextResponse.json(
        createErrorResponse('No fields to update provided', 400).body,
        { status: 400 }
      );
    }

    // Validation: role must be valid
    if (role && !Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        createErrorResponse('Invalid role value', 400).body,
        { status: 400 }
      );
    }

    // Step 3: Get current user data before update
    const supabase = await createClient();
    const { data: currentUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (fetchError || !currentUser) {
      return NextResponse.json(
        createErrorResponse('User not found', 404).body,
        { status: 404 }
      );
    }

    // Step 4: Prepare update data
    const updateData: any = {};
    const oldValues: any = {};
    const newValues: any = {};

    if (full_name !== undefined) {
      updateData.full_name = full_name;
      oldValues.full_name = currentUser.full_name;
      newValues.full_name = full_name;
    }

    if (phone_number !== undefined) {
      updateData.phone_number = phone_number;
      oldValues.phone_number = currentUser.phone_number;
      newValues.phone_number = phone_number;
    }

    if (role !== undefined) {
      updateData.role = role;
      oldValues.role = currentUser.role;
      newValues.role = role;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
      oldValues.is_active = currentUser.is_active;
      newValues.is_active = is_active;
    }

    // Step 5: Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', targetUserId)
      .select();

    if (updateError) {
      console.error('[ADMIN] Update error:', updateError);
      return NextResponse.json(
        createErrorResponse('Failed to update user', 400).body,
        { status: 400 }
      );
    }

    // Step 6: Log audit trail
    const actionType = is_active !== undefined
      ? is_active ? 'activate' : 'deactivate'
      : role !== undefined ? 'role_change' : 'data_edit';

    await logAuditTrail(
      actionType,
      auth.userId,
      targetUserId,
      oldValues,
      newValues,
      reason
    );

    return NextResponse.json(
      createSuccessResponse({
        message: 'User updated successfully',
        user: updatedUser?.[0],
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN] POST /api/admin/users/[userId] error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('Admin access required', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}
