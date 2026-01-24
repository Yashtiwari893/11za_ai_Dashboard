import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/providers/supabase-provider";
import { createClient } from "@/utils/supabase/server";
import LiveVoiceAgentInitializer from "@/components/live-voice-agent-initializer";
import Sidebar from "@/components/sidebar";
import Footer from "@/components/footer";
import { headers } from 'next/headers'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "11za AI Dashboard",
  description: "Intelligent Conversational AI Platform for Business Communication",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers()
  const host = headersList.get('host')
  const referer = headersList.get('referer')
  
  // Try to extract pathname from referer or other headers
  let pathname = '/'
  if (referer && host) {
    try {
      const url = new URL(referer)
      pathname = url.pathname
    } catch {
      pathname = '/'
    }
  }

  // Define auth pages that should not show sidebar/footer
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password']
  const isAuthPage = authPages.some(page => pathname.startsWith(page) || pathname === page)

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('Layout check:', { pathname, isAuthPage })

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider session={session}>
          <LiveVoiceAgentInitializer />
          {isAuthPage ? (
            <div className="min-h-screen">
              {children}
            </div>
          ) : (
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
          )}
        </SupabaseProvider>
      </body>
    </html>
  );
}
