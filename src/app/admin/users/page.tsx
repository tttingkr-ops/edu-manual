// Created: 2026-01-27 17:10:00
import { createClient } from '@/lib/supabase/server'
import UsersContent from './UsersContent'

export default async function UsersPage() {
  const supabase = await createClient()

  // 모든 사용자 조회
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  return <UsersContent users={users || []} />
}
