'use client'

import { createClient } from '@/lib/supabaseClient'
import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type SupabaseContext = {
  supabase: any
  user: User | null
  session: Session | null
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export default function SupabaseProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  // Use the singleton memoized client
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(session?.user ?? null)
  const router = useRouter()

  useEffect(() => {
    // Get the authenticated user securely from the server
    const getAuthenticatedUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user ?? null)
    }

    getAuthenticatedUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      // When auth state changes, fetch the secure user object
      getAuthenticatedUser()
      router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const value = {
    supabase,
    user,
    session,
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useSupabase = () => {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useSupabase must be used inside SupabaseProvider')
  }
  return context
}