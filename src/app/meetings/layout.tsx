// Created: 2026-02-11 14:30:00
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'

export default async function MeetingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('username, role, nickname')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        userName={userData.nickname || userData.username || user.email?.split('@')[0]}
        userRole={userData.role as 'admin' | 'manager'}
      />
      <main>{children}</main>
    </div>
  )
}
