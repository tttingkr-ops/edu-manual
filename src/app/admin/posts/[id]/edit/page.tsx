// Created: 2026-01-27 18:00:00
// Updated: 2026-01-29 - Mock 제거, 그룹 데이터 조회 추가
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditPostContent from './EditPostContent'

type GroupName = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개'

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

  // 그룹 데이터 조회
  const { data: postGroups } = await supabase
    .from('post_groups')
    .select('group_name')
    .eq('post_id', id)

  const initialGroups = (postGroups || []).map(pg => pg.group_name as GroupName)

  return <EditPostContent post={post} initialGroups={initialGroups} />
}
