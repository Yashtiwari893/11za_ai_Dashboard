import { redirect } from 'next/navigation'

export default function HomePage() {
  // This page will be handled by middleware
  // Unauthenticated users will be redirected to /login
  // Authenticated users will be redirected to /dashboard
  redirect('/login')
}
