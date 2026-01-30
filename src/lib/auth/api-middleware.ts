/**
 * API Middleware for authentication & authorization
 * SECURITY: All protected endpoints MUST use this middleware
 * NOTE: This file is kept for backward compatibility but endpoints now use hierarchical-rbac instead
 */

import { NextRequest, NextResponse } from 'next/server'

// This middleware has been replaced with hierarchical-rbac.ts
// Keeping stub functions for backward compatibility only

export async function requireAuth(request: NextRequest) {
  return {
    status: 500,
    error: 'Use hierarchical-rbac instead',
    user: null
  }
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
) {
  return {
    status: 500,
    error: 'Use hierarchical-rbac instead',
    user: null
  }
}

export function withAuth(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    return NextResponse.json(
      { error: 'Use hierarchical-rbac instead' },
      { status: 500 }
    )
  }
}

export function withRole(
  allowedRoles: string[],
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    return NextResponse.json(
      { error: 'Use hierarchical-rbac instead' },
      { status: 500 }
    )
  }
}

export async function getUser(request: NextRequest) {
  return null
}
