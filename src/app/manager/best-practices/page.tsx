// Created: 2026-02-23 00:00:00
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerBestPracticesContent from './ManagerBestPracticesContent'

export default async function ManagerBestPracticesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: allPosts },
    { data: postGroups },
    { data: targetUsers },
    { data: userGroups },
    { data: readStatuses },
    { data: groups },
  ] = await Promise.all([
    supabase.from('best_practice_posts').select('*').order('created_at', { ascending: false }),
    supabase.from('best_practice_groups').select('post_id, group_name'),
    supabase.from('best_practice_target_users').select('post_id').eq('user_id', user.id),
    supabase.from('user_groups').select('group_id, groups(name)').eq('user_id', user.id),
    supabase.from('best_practice_read_status').select('post_id, is_read').eq('user_id', user.id),
    supabase.from('groups').select('id, name').order('name'),
  ])

  // 사용자가 속한 그룹명 Set
  const userGroupNames = new Set(
    (userGroups || []).map((ug: any) => ug.groups?.name).filter(Boolean)
  )

  // 개인 타겟팅된 게시물 ID Set
  const individualTargetedIds = new Set((targetUsers || []).map(t => t.post_id))

  // 게시물별 그룹명 Map
  const postGroupMap = new Map<string, string[]>()
  for (const pg of (postGroups || [])) {
    const existing = postGroupMap.get(pg.post_id) || []
    existing.push(pg.group_name)
    postGroupMap.set(pg.post_id, existing)
  }

  // 이 매니저에게 보여야 할 게시물 필터링
  const filteredPosts = (allPosts || []).filter(post => {
    if (post.targeting_type === 'individual') {
      return individualTargetedIds.has(post.id)
    }
    const postGroupNames = postGroupMap.get(post.id) || []
    if (postGroupNames.length === 0) return true
    return postGroupNames.some(gn => userGroupNames.has(gn))
  })

  // 읽음 상태 Map
  const readStatusMap = new Map((readStatuses || []).map(rs => [rs.post_id, rs.is_read]))

  const postsWithMeta = filteredPosts.map(post => ({
    ...post,
    targetGroups: postGroupMap.get(post.id) || [],
    isRead: readStatusMap.get(post.id) || false,
  }))

  return (
    <ManagerBestPracticesContent
      posts={postsWithMeta}
      groups={groups || []}
      userGroupNames={Array.from(userGroupNames) as string[]}
    />
  )
}
