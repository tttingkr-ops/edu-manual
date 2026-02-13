// Created: 2026-01-27 17:10:00
import { createClient } from '@/lib/supabase/server'
import UsersContent from './UsersContent'

// 교육 카테고리 목록 (게시물/테스트와 동일)
const EDUCATION_CATEGORIES = [
  { id: '남자_매니저_대화', label: '남자 매니저 대화' },
  { id: '여자_매니저_대화', label: '여자 매니저 대화' },
  { id: '여자_매니저_소개', label: '여자 매니저 소개' },
  { id: '추가_서비스_규칙', label: '추가 서비스 규칙' },
]

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

  // 교육 카테고리에 해당하는 그룹이 없으면 자동 생성
  // 그룹명은 공백 버전(label)과 언더스코어 버전(id) 모두 체크
  const existingGroupNames = new Set((groups || []).map((g: any) => g.name))
  for (const cat of EDUCATION_CATEGORIES) {
    const hasSpaceVersion = existingGroupNames.has(cat.label)
    const hasUnderscoreVersion = existingGroupNames.has(cat.id)
    if (!hasSpaceVersion && !hasUnderscoreVersion) {
      await supabase.from('groups').insert({ name: cat.label })
    }
  }

  // 중복 그룹 정리: 공백 버전과 언더스코어 버전이 동시에 존재하면 공백 버전 삭제
  // (기존 사용자 할당이 언더스코어 버전에 연결되어 있으므로 언더스코어 버전 유지)
  const { data: allGroups } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: true })

  for (const cat of EDUCATION_CATEGORIES) {
    const spaceGroup = (allGroups || []).find((g: any) => g.name === cat.label)
    const underscoreGroup = (allGroups || []).find((g: any) => g.name === cat.id)
    if (spaceGroup && underscoreGroup) {
      // 둘 다 존재하면 공백 버전 삭제 (언더스코어 버전에 기존 할당 유지)
      await supabase.from('groups').delete().eq('id', spaceGroup.id)
    }
  }

  // 정리 후 그룹 목록 다시 조회
  const { data: updatedGroups } = await supabase
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
      groups={updatedGroups || []}
      userGroups={userGroups || []}
    />
  )
}
