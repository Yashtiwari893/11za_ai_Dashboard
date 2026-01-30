'use client'

/**
 * Authentication Context
 * SECURITY: Manages user state, token verification, session persistence
 */

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role: string
  team_id?: string
  token_expires_at?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // STEP 1: Initialize auth state on mount (restore from sessionStorage)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Restore user from sessionStorage
        const storedUser = sessionStorage.getItem('auth_user')
        const token = sessionStorage.getItem('auth_token')

        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)

          // Verify token is still valid
          const expiresAt = parsedUser.token_expires_at
          if (expiresAt) {
            const now = new Date().getTime()
            const expireTime = new Date(expiresAt).getTime()

            if (now > expireTime) {
              // Token expired - clear session
              console.warn('[AuthProvider] Stored token expired, clearing session')
              sessionStorage.removeItem('auth_user')
              sessionStorage.removeItem('auth_token')
              setUser(null)
            }
          }
        }
      } catch (error) {
        console.error('[AuthProvider] Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // STEP 2: Check token validity periodically (every 5 minutes)
  useEffect(() => {
    const tokenCheckInterval = setInterval(() => {
      if (user && user.token_expires_at) {
        const now = new Date().getTime()
        const expireTime = new Date(user.token_expires_at).getTime()
        const timeUntilExpire = expireTime - now

        // If token expires in less than 5 minutes, refresh it
        if (timeUntilExpire < 5 * 60 * 1000) {
          console.log('[AuthProvider] Token expiring soon, refreshing...')
          refreshToken()
        }

        // If token already expired, logout
        if (now > expireTime) {
          console.warn('[AuthProvider] Token expired, logging out...')
          logout()
        }
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(tokenCheckInterval)
  }, [user])

  const login = async (email: string, password: string) => {
    try {
      // Call login API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Login failed')
      }

      const data = await response.json()

      // Store user and token
      setUser(data.user)
      sessionStorage.setItem('auth_user', JSON.stringify(data.user))
      sessionStorage.setItem('auth_token', data.token)

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('[AuthProvider] Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Call logout API (optional - for server-side cleanup)
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch (error) {
        console.warn('[AuthProvider] Logout API call failed:', error)
      }

      // Clear local session
      setUser(null)
      sessionStorage.removeItem('auth_user')
      sessionStorage.removeItem('auth_token')

      // Redirect to login
      router.push('/login')
    } catch (error) {
      console.error('[AuthProvider] Logout error:', error)
    }
  }

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST'
      })

      if (!response.ok) {
        // Refresh failed, logout user
        await logout()
        return
      }

      const data = await response.json()

      // Update user and token
      setUser(data.user)
      sessionStorage.setItem('auth_user', JSON.stringify(data.user))
      sessionStorage.setItem('auth_token', data.token)
    } catch (error) {
      console.error('[AuthProvider] Token refresh error:', error)
      // On error, logout for safety
      await logout()
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 * THROWS: Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
