// Created: 2026-01-27 18:00:00
// Updated: 2026-01-29 - Mock 제거, 그룹 데이터 조회 추가
// Updated: 2026-02-10 - 개인 타겟팅 데이터 조회 추가
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditPostContent from './EditPostContent'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 게시물 조회
  const { data: post } = await supabase
    .from('educational_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (!post) {
    notFound()
  }

  // 그룹 데이터, 개인 타겟 데이터, 닉네임 조회
  const [{ data: postGroups }, { data: targetUsers }, { data: nicknameUsers }] = await Promise.all([
    supabase.from('post_groups').select('group_name').eq('post_id', id),
    supabase.from('post_target_users').select('user_id').eq('post_id', id),
    supabase.from('users').select('nickname').not('nickname', 'is', null),
  ])

  const initialGroups = (postGroups || []).map(pg => pg.group_name)
  const initialTargetUsers = (targetUsers || []).map(t => t.user_id)
  const nicknames = (nicknameUsers || []).map((u: any) => u.nickname).filter(Boolean) as string[]

  return (
    <EditPostContent
      post={post}
      initialGroups={initialGroups}
      initialTargetUsers={initialTargetUsers}
      nicknames={nicknames}
    />
  )
}
