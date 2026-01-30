/**
 * ============================================
 * GET /api/user/profile
 * POST /api/user/profile
 * ============================================
 * 
 * User endpoint to view and update their own profile
 * 
 * GET: View current user profile
 * POST: Update own profile (only allowed fields)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate
    const auth = await requireAuth();

    // Step 2: Fetch own profile
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, phone_number, is_active, created_at, last_login')
      .eq('id', auth.userId)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        createErrorResponse('Profile not found', 404).body,
        { status: 404 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(profile).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[USER] GET /api/user/profile error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('User account is inactive', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate
    const auth = await requireAuth();

    // Step 2: Parse request body
    const body = await request.json();
    const { full_name, phone_number } = body;

    // Validation: Users can only update specific fields
    if (full_name === undefined && phone_number === undefined) {
      return NextResponse.json(
        createErrorResponse('No fields to update provided', 400).body,
        { status: 400 }
      );
    }

    // Users cannot update: role, is_active, email
    if ('role' in body || 'is_active' in body || 'email' in body) {
      return NextResponse.json(
        createErrorResponse('You cannot modify these fields', 403).body,
        { status: 403 }
      );
    }

    // Step 3: Update own profile
    const supabase = await createClient();
    const updateData: any = {};

    if (full_name !== undefined) {
      updateData.full_name = full_name;
    }

    if (phone_number !== undefined) {
      updateData.phone_number = phone_number;
    }

    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', auth.userId)
      .select();

    if (error) {
      console.error('[USER] Update error:', error);
      return NextResponse.json(
        createErrorResponse('Failed to update profile', 400).body,
        { status: 400 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        message: 'Profile updated successfully',
        profile: updatedProfile?.[0],
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[USER] POST /api/user/profile error:', error);

    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        createErrorResponse('Authentication required', 401).body,
        { status: 401 }
      );
    }

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        createErrorResponse('User account is inactive', 403).body,
        { status: 403 }
      );
    }

    return NextResponse.json(
      createErrorResponse('Internal server error', 500).body,
      { status: 500 }
    );
  }
}
