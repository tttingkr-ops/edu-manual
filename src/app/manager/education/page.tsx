// Created: 2026-01-27 16:30:00
import { createClient } from '@/lib/supabase/server'
import EducationContent from './EducationContent'

export default async function EducationPage() {
  const supabase = await createClient()

  // 현재 사용자 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 모든 교육 게시물 + 서브카테고리 + 읽음 상태 + 타겟팅 정보 조회
  const [
    { data: posts },
    { data: readStatuses },
    { data: subCategories },
    { data: userGroups },
    { data: postGroups },
    { data: postTargetUsers },
  ] = await Promise.all([
    supabase
      .from('educational_posts')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('read_status')
      .select('post_id, is_read')
      .eq('user_id', user.id),
    supabase
      .from('sub_categories')
      .select('*')
      .order('sort_order')
      .order('name'),
    // 사용자가 속한 그룹 조회
    supabase
      .from('user_groups')
      .select('group_id, groups(name)')
      .eq('user_id', user.id),
    // 모든 게시물-그룹 연결 조회
    supabase
      .from('post_groups')
      .select('post_id, group_name'),
    // 개별 타겟팅된 게시물 조회
    supabase
      .from('post_target_users')
      .select('post_id')
      .eq('user_id', user.id),
  ])

  // 사용자가 속한 그룹명 Set 생성
  const userGroupNames = new Set(
    (userGroups || []).map((ug: any) => ug.groups?.name).filter(Boolean)
  )

  // 개별 타겟팅된 게시물 ID Set 생성
  const individuallyTargetedPostIds = new Set(
    (postTargetUsers || []).map((pt: any) => pt.post_id)
  )

  // 게시물별 그룹명 Map 생성
  const postGroupMap = new Map<string, string[]>()
  for (const pg of (postGroups || [])) {
    const existing = postGroupMap.get(pg.post_id) || []
    existing.push(pg.group_name)
    postGroupMap.set(pg.post_id, existing)
  }

  // 타겟팅 기준으로 게시물 필터링
  const filteredPosts = (posts || []).filter((post: any) => {
    if (post.targeting_type === 'individual') {
      return individuallyTargetedPostIds.has(post.id)
    }
    // targeting_type === 'group' (또는 레거시 게시물)
    const postGroupNames = postGroupMap.get(post.id) || []
    if (postGroupNames.length === 0) return true // 그룹 미지정 게시물은 모두에게 공개
    return postGroupNames.some(gn => userGroupNames.has(gn))
  })

  // 읽음 상태를 Map으로 변환
  const readStatusMap = new Map(
    readStatuses?.map((rs: { post_id: string; is_read: boolean }) => [rs.post_id, rs.is_read]) || []
  )

  // 필터링된 게시물에 읽음 상태 추가
  const postsWithReadStatus = filteredPosts.map((post: any) => ({
    ...post,
    isRead: readStatusMap.get(post.id) || false,
  }))

  // 사용자 그룹 → 허용 카테고리 계산 (그룹명의 공백을 언더스코어로 변환)
  const userGroupNamesList = Array.from(userGroupNames)
  const allowedCategories = userGroupNamesList.length > 0
    ? userGroupNamesList.map(name => name.replace(/ /g, '_'))
    : null // null = 모든 카테고리 접근 가능

  return <EducationContent posts={postsWithReadStatus} subCategories={subCategories || []} allowedCategories={allowedCategories} />
}
