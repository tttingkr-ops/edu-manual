// Created: 2026-01-27 16:30:00
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 사용자 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 정보 조회
  const { data: userData } = await supabase
    .from('users')
    .select('username, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        userName={userData?.username || user.email?.split('@')[0]}
        userRole={userData?.role as 'admin' | 'manager'}
      />
      <main>{children}</main>
    </div>
  )
}
