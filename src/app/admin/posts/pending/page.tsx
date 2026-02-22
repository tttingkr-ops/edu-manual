// Created: 2026-02-17 10:00:00
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PendingPostsContent from './PendingPostsContent'

export default async function PendingPostsPage() {
  const supabase = await createClient()

  // 현재 사용자 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 관리자 확인
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    redirect('/')
  }

  // 승인 대기 게시물 조회 (작성자 정보 포함)
  const [{ data: pendingPosts }, { data: allTargetUsers }, { data: allManagers }] = await Promise.all([
    supabase
      .from('educational_posts')
      .select('*, users!educational_posts_author_id_fkey(username, nickname)')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('post_target_users')
      .select('post_id, user_id'),
    supabase
      .from('users')
      .select('id, username, nickname'),
  ])

  const posts = (pendingPosts || []).map((post: any) => {
    const targetUserIds = (allTargetUsers || [])
      .filter(t => t.post_id === post.id)
      .map(t => t.user_id)
    const recipients = (allManagers || [])
      .filter(u => targetUserIds.includes(u.id))
      .map(u => ({ name: u.nickname || u.username }))
    return {
      ...post,
      author_name: post.users?.nickname || post.users?.username || '알 수 없음',
      author_nickname: post.users?.nickname || null,
      recipients,
    }
  })

  return <PendingPostsContent posts={posts} />
}
