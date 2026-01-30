/**
 * ============================================
 * GET /api/admin/users
 * ============================================
 * 
 * Admin endpoint to fetch all users with pagination and filters
 * 
 * Query Parameters:
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 *   - role: 'admin' | 'user' (optional filter)
 *   - isActive: 'true' | 'false' (optional filter)
 *   - search: string (search by email or name)
 * 
 * Response: List of users with pagination metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireAdmin,
  createErrorResponse,
  createSuccessResponse,
  UserRole,
} from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate and verify admin role
    const auth = await requireAuth();
    requireAdmin(auth);

    // Step 2: Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const role = searchParams.get('role') as UserRole | null;
    const isActive = searchParams.get('isActive') as 'true' | 'false' | null;
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    // Step 3: Build query
    const supabase = await createClient();
    let query = supabase
      .from('user_profiles')
      .select('id, email, full_name, role, phone_number, is_active, last_login, created_at', {
        count: 'exact',
      });

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,full_name.ilike.%${search}%`
      );
    }

    // Step 4: Apply pagination and fetch
    const { data: users, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[ADMIN] Error fetching users:', error);
      return NextResponse.json(
        createErrorResponse('Failed to fetch users', 400).body,
        { status: 400 }
      );
    }

    // Step 5: Return paginated response
    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json(
      createSuccessResponse({
        users: users || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN] GET /api/admin/users error:', error);

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
