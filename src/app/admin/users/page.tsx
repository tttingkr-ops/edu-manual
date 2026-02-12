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

  // 그룹 목록 조회
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: true })

  // 사용자-그룹 매핑 조회
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select('*')

  return (
    <UsersContent
      users={users || []}
      groups={groups || []}
      userGroups={userGroups || []}
    />
  )
}
