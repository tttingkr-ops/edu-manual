// Created: 2026-01-27 17:15:00
// Updated: 2026-01-29 - 미확인 인원 데이터 조회 추가
// Updated: 2026-02-18 - 대상 지정(그룹/개인) 데이터 조회 추가
import { createClient } from '@/lib/supabase/server'
import PostsContent from './PostsContent'

export default async function PostsPage() {
  const supabase = await createClient()

  // 모든 교육 게시물 + 읽음 상태 + 대상 지정 조회
  const [
    { data: posts },
    { data: readStatuses },
    { data: allManagers },
    { data: postGroups },
    { data: postTargetUsers },
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
  ])

  // 각 게시물별 미확인 매니저 + 대상 지정 계산
  const postsWithUnread = (posts || []).map(post => {
    const readUserIds = new Set(
      (readStatuses || [])
        .filter(r => r.post_id === post.id && r.is_read)
        .map(r => r.user_id)
    )

    const unreadManagers = (allManagers || []).filter(m => !readUserIds.has(m.id))

    const targetGroups = (postGroups || [])
      .filter(pg => pg.post_id === post.id)
      .map(pg => pg.group_name)

    const targetUserIds = (postTargetUsers || [])
      .filter(ptu => ptu.post_id === post.id)
      .map(ptu => ptu.user_id)

    const targetUsers = (allManagers || [])
      .filter(m => targetUserIds.includes(m.id))
      .map(m => ({ username: m.username, nickname: (m as any).nickname as string | null }))

    return {
      ...post,
      unreadCount: unreadManagers.length,
      unreadManagers: unreadManagers,
      targetGroups,
      targetUsers,
    }
  })

  return <PostsContent posts={postsWithUnread} />
}
