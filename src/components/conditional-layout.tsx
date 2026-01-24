'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Footer from '@/components/footer'

const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password']

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  // Check if current page is an auth page
  const isAuthPage = AUTH_PAGES.some(page => pathname === page || pathname.startsWith(page + '/'))

  if (isAuthPage) {
    return (
      <div className="min-h-screen">
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-[#0D163F] dark:via-[#1a1f4a] dark:to-[#2a2f5a]">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-[#0D163F] dark:via-[#1a1f4a] dark:to-[#2a2f5a] lg:ml-0">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}