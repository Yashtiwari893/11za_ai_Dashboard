
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import {
  Home,
  Bot,
  BookOpen,
  Settings,
  LogOut,
  Plug,
  Menu,
  X,
  User,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Chatbots', href: '/chat', icon: Bot },
  { name: 'Knowledge', href: '/files', icon: BookOpen },
  { name: 'Integrations', href: '/shopify', icon: Plug },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="outline"
          size="sm"
          className="bg-white/90 backdrop-blur-sm border-gray-200 shadow-lg"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 lg:w-64
        bg-white dark:bg-[#0D163F]
        shadow-lg border-r border-gray-200 dark:border-[#2a2f5a]
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200 dark:border-[#2a2f5a]">
            <img
              src="https://11za.com/wp-content/themes/one-1za/assets/images/logo/11za_logo.svg"
              alt="11za AI"
              className="h-8 w-auto"
            />
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-[#09AF72]/10 dark:bg-[#09AF72]/20 text-[#0D163F] dark:text-[#09AF72] border-r-2 border-[#09AF72]'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#09AF72]/5 dark:hover:bg-[#09AF72]/10 hover:text-[#0D163F] dark:hover:text-white'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Info Section */}
          {user && (
            <div className="p-4 border-t border-gray-200 dark:border-[#2a2f5a]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#09AF72]/10 rounded-full">
                  <User className="h-4 w-4 text-[#0D163F]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0D163F] dark:text-white truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full flex items-center justify-center border-[#09AF72] text-[#0D163F] dark:border-[#09AF72] dark:text-[#09AF72] hover:bg-[#09AF72] hover:text-white dark:hover:bg-[#09AF72] dark:hover:text-white"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}