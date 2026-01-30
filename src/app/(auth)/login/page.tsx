'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

/**
 * ============================================
 * LOGIN PAGE WITH ROLE-BASED ROUTING
 * ============================================
 * 
 * After successful login, users are redirected to:
 * - /admin for admin users
 * - /user for regular users
 * 
 * This ensures each user sees only the appropriate dashboard.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { supabase } = useSupabase()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Step 1: Sign in with Supabase
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // Step 2: Fetch user's role from database
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('email', email)
        .single()

      if (profileError || !userProfile) {
        setError('User profile not found')
        setLoading(false)
        return
      }

      // Step 3: Check if user is active
      if (!userProfile.is_active) {
        setError('Your account has been deactivated. Please contact support.')
        // Sign out the user immediately
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // Step 4: Redirect based on role
      const dashboardPath = userProfile.role === 'admin' ? '/admin' : '/user'
      router.push(dashboardPath)
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="https://11za.com/wp-content/themes/one-1za/assets/images/logo/11za_logo.svg"
            alt="11za AI"
            className="h-12 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-[#0D163F]">Welcome to 11za AI</h1>
          <p className="text-[#64748b] mt-2">Sign in to access your dashboard</p>
        </div>

        <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#0D163F]">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#0D163F]">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#0D163F]">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="text-right">
                  <Link href="/forgot-password" className="text-sm text-[#09AF72] hover:text-[#0D163F]">
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#0D163F] hover:bg-[#09AF72] text-white"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-[#64748b]">
                Don't have an account?{" "}
                <Link href="/signup" className="text-[#09AF72] hover:text-[#0D163F] font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-xs text-[#64748b]">
          <p>© 2026 11za Communications. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}