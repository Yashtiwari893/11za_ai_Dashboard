/**
 * ============================================
 * GET /api/admin/stats
 * ============================================
 * 
 * Admin endpoint to fetch system statistics
 * 
 * Returns:
 *   - Total users count
 *   - Active users count
 *   - Admin users count
 *   - User distribution by role
 *   - Recent activities
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  requireAuth,
  requireAdmin,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate and verify admin role
    const auth = await requireAuth();
    requireAdmin(auth);

    // Step 2: Fetch statistics
    const supabase = await createClient();

    // Total users
    const { count: totalUsers, error: totalError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // Active users
    const { count: activeUsers, error: activeError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Users by role
    const { data: usersByRole, error: roleError } = await supabase
      .from('user_profiles')
      .select('role, id', { count: 'exact' });

    const roleDistribution = {
      admin: usersByRole?.filter(u => u.role === 'admin').length || 0,
      user: usersByRole?.filter(u => u.role === 'user').length || 0,
    };

    // Recent audit log activities (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActivities, error: activitiesError } = await supabase
      .from('user_audit_log')
      .select('action, created_at, admin_id')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // Activity summary
    const activitySummary = recentActivities?.reduce((acc: any, activity: any) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {}) || {};

    if (totalError || activeError || roleError) {
      console.error('[ADMIN] Stats fetch error:', {
        totalError,
        activeError,
        roleError,
      });
      return NextResponse.json(
        createErrorResponse('Failed to fetch statistics', 500).body,
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        summary: {
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          inactiveUsers: (totalUsers || 0) - (activeUsers || 0),
        },
        roleDistribution,
        activitySummary,
        lastUpdated: new Date().toISOString(),
      }).body,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN] GET /api/admin/stats error:', error);

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
