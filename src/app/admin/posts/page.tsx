// Created: 2026-01-27 17:15:00
// Updated: 2026-01-29 - 미확인 인원 데이터 조회 추가
// Updated: 2026-02-18 - 대상 지정(그룹/개인) 데이터 조회 추가
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import PostsContent from './PostsContent'

export default async function PostsPage() {
  const supabase = await createClient()

  // 모든 교육 게시물 + 읽음 상태 + 대상 지정 + 댓글 수 조회
  const [
    { data: posts },
    { data: readStatuses },
    { data: allManagers },
    { data: postGroups },
    { data: postTargetUsers },
    { data: commentCounts },
    { data: userGroups },
  ] = await Promise.all([
    supabase
      .from('educational_posts')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('read_status')
      .select('post_id, user_id, is_read'),
    supabase
      .from('users')
      .select('id, username, nickname')
      .eq('role', 'manager'),
    supabase
      .from('post_groups')
      .select('post_id, group_name'),
    supabase
      .from('post_target_users')
      .select('post_id, user_id'),
    supabase
      .from('education_comments')
      .select('post_id'),
    supabase
      .from('user_groups')
      .select('user_id, group_name'),
  ])

  // 매니저별 그룹 목록 맵 생성 (user_id → group_name[])
  const managerGroupMap = new Map<string, string[]>()
  for (const ug of (userGroups || [])) {
    const groups = managerGroupMap.get(ug.user_id) || []
    groups.push(ug.group_name)
    managerGroupMap.set(ug.user_id, groups)
  }

  // 각 게시물별 미확인 매니저 + 대상 지정 계산
  const postsWithUnread = (posts || []).map(post => {
    const readUserIds = new Set(
      (readStatuses || [])
        .filter(r => r.post_id === post.id && r.is_read)
        .map(r => r.user_id)
    )

    const targetGroups = (postGroups || [])
      .filter(pg => pg.post_id === post.id)
      .map(pg => pg.group_name)

    const targetUserIds = (postTargetUsers || [])
      .filter(ptu => ptu.post_id === post.id)
      .map(ptu => ptu.user_id)

    // 이 게시물의 실제 수신 대상 매니저만 필터링
    let audienceManagers = (allManagers || [])
    if (targetUserIds.length > 0) {
      // 개인 지정: 지정된 유저만
      audienceManagers = audienceManagers.filter(m => targetUserIds.includes(m.id))
    } else if (targetGroups.length > 0) {
      // 그룹 지정: 해당 그룹에 속한 매니저만
      audienceManagers = audienceManagers.filter(m => {
        const mGroups = managerGroupMap.get(m.id) || []
        return targetGroups.some(g => mGroups.includes(g))
      })
    }
    // 대상 없음(전체): audienceManagers = 전체 매니저 (변경 없음)

    const unreadManagers = audienceManagers.filter(m => !readUserIds.has(m.id))

    const targetUsers = (allManagers || [])
      .filter(m => targetUserIds.includes(m.id))
      .map(m => ({ username: m.username, nickname: (m as any).nickname as string | null }))

    const commentCount = (commentCounts || []).filter(c => c.post_id === post.id).length

    return {
      ...post,
      unreadCount: unreadManagers.length,
      unreadManagers: unreadManagers,
      targetGroups,
      targetUsers,
      comment_count: commentCount,
    }
  })

  return <PostsContent posts={postsWithUnread} />
}
