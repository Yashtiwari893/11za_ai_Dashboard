import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/providers/supabase-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { createClient } from "@/utils/supabase/server";
import LiveVoiceAgentInitializer from "@/components/live-voice-agent-initializer";
import ConditionalLayout from "@/components/conditional-layout";

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
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SupabaseProvider session={session}>
            <LiveVoiceAgentInitializer />
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </SupabaseProvider>
        </AuthProvider>
      </body>
    </html>
  );
}