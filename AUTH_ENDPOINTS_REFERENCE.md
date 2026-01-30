/**
 * LOGIN ENDPOINT
 * File: src/app/api/auth/login/route.ts
 * 
 * Handles user login - returns JWT token + user profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { jwtDecode } from 'jwt-decode'

interface LoginRequest {
  email: string
  password: string
}

interface DecodedToken {
  sub: string
  exp: number
  iat: number
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as LoginRequest

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate with Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.session) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const token = data.session.access_token
    const userId = data.session.user.id

    // Decode token to get expiration
    const decoded = jwtDecode<DecodedToken>(token)
    const tokenExpiresAt = new Date(decoded.exp * 1000).toISOString()

    // Fetch user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role, team_id, team_admin_of')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 500 }
      )
    }

    // Return user + token
    return NextResponse.json({
      user: {
        ...userProfile,
        token_expires_at: tokenExpiresAt
      },
      token
    })
  } catch (error) {
    console.error('[Login] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * LOGOUT ENDPOINT (Optional - for cleanup)
 * File: src/app/api/auth/logout/route.ts
 * 
 * Handles logout - optional cleanup on server side
 */

export async function POST_LOGOUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Sign out user
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.warn('[Logout] Supabase signout error:', error)
    }

    // Return success (logout is primarily client-side)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Logout] Error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}

/**
 * TOKEN REFRESH ENDPOINT
 * File: src/app/api/auth/refresh/route.ts
 * 
 * Refreshes expired token
 */

export async function POST_REFRESH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Refresh session
    const { data, error } = await supabase.auth.refreshSession()

    if (error || !data.session) {
      return NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 401 }
      )
    }

    const token = data.session.access_token
    const userId = data.session.user.id

    // Decode token to get expiration
    const decoded = jwtDecode<DecodedToken>(token)
    const tokenExpiresAt = new Date(decoded.exp * 1000).toISOString()

    // Fetch user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, email, role, team_id, team_admin_of')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      user: {
        ...userProfile,
        token_expires_at: tokenExpiresAt
      },
      token
    })
  } catch (error) {
    console.error('[Refresh] Error:', error)
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    )
  }
}
