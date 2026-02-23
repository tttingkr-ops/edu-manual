// Created: 2026-02-23 00:00:00
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import BestPracticesContent from './BestPracticesContent'

export default async function BestPracticesPage() {
  const supabase = await createClient()

  const [
    { data: posts },
    { data: groups },
    { data: postGroups },
    { data: targetUsers },
    { data: allManagers },
    { data: readStatuses },
  ] = await Promise.all([
    supabase
      .from('best_practice_posts')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('groups')
      .select('id, name')
      .order('name'),
    supabase
      .from('best_practice_groups')
      .select('post_id, group_name'),
    supabase
      .from('best_practice_target_users')
      .select('post_id, user_id'),
    supabase
      .from('users')
      .select('id, username, nickname')
      .eq('role', 'manager'),
    supabase
      .from('best_practice_read_status')
      .select('post_id, user_id, is_read'),
  ])

  // 게시물별 그룹/대상 계산
  const postsWithMeta = (posts || []).map(post => {
    const postGroupList = (postGroups || [])
      .filter(pg => pg.post_id === post.id)
      .map(pg => pg.group_name)

    const postTargetUserIds = (targetUsers || [])
      .filter(tu => tu.post_id === post.id)
      .map(tu => tu.user_id)

    const postTargetUsersList = (allManagers || [])
      .filter(m => postTargetUserIds.includes(m.id))
      .map(m => ({ id: m.id, username: m.username, nickname: m.nickname }))

    const readUserIds = new Set(
      (readStatuses || [])
        .filter(r => r.post_id === post.id && r.is_read)
        .map(r => r.user_id)
    )

    // 수신 대상 매니저 계산 (targeting 기준)
    let audienceManagers = (allManagers || [])
    if (postTargetUserIds.length > 0) {
      audienceManagers = audienceManagers.filter(m => postTargetUserIds.includes(m.id))
    } else if (postGroupList.length > 0) {
      // group_name 기반 필터는 여기서 단순화 (전체 표시)
      audienceManagers = audienceManagers
    }

    const unreadManagers = audienceManagers.filter(m => !readUserIds.has(m.id))

    return {
      ...post,
      targetGroups: postGroupList,
      targetUsers: postTargetUsersList,
      unreadCount: unreadManagers.length,
      unreadManagers,
    }
  })

  return (
    <BestPracticesContent
      posts={postsWithMeta}
      groups={groups || []}
    />
  )
}
