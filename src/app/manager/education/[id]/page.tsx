// Created: 2026-01-27 16:30:00
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostDetail from './PostDetail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 현재 사용자 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 게시물 조회
  const { data: post, error } = await supabase
    .from('educational_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !post) {
    notFound()
  }

  // 관련 테스트 문제 존재 여부 확인
  const { data: testQuestions } = await supabase
    .from('test_questions')
    .select('id')
    .eq('related_post_id', id)
    .limit(1)

  const hasRelatedTest = (testQuestions?.length || 0) > 0

  return (
    <PostDetail
      post={post}
      userId={user.id}
      hasRelatedTest={hasRelatedTest}
    />
  )
}
