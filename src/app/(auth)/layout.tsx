import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "11za AI Dashboard - Authentication",
  description: "Sign in to your 11za AI Dashboard account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 dark:from-[#0D163F] dark:via-[#1a1f4a] dark:to-[#2a2f5a]`}
    >
      <div className="min-h-screen flex items-center justify-center">{children}</div>
    </div>
  );
}