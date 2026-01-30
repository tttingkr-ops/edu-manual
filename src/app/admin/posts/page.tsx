// Created: 2026-01-27 17:15:00
// Updated: 2026-01-29 - 미확인 인원 데이터 조회 추가
import { createClient } from '@/lib/supabase/server'
import PostsContent from './PostsContent'

export default async function PostsPage() {
  const supabase = await createClient()

  // 모든 교육 게시물 + 읽음 상태 조회
  const [
    { data: posts },
    { data: readStatuses },
    { data: allManagers },
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
      .select('id, name')
      .eq('role', 'manager'),
  ])

  // 각 게시물별 미확인 매니저 계산
  const postsWithUnread = (posts || []).map(post => {
    const readUserIds = new Set(
      (readStatuses || [])
        .filter(r => r.post_id === post.id && r.is_read)
        .map(r => r.user_id)
    )

    const unreadManagers = (allManagers || []).filter(m => !readUserIds.has(m.id))

    return {
      ...post,
      unreadCount: unreadManagers.length,
      unreadManagers: unreadManagers,
    }
  })

  return <PostsContent posts={postsWithUnread} />
}
