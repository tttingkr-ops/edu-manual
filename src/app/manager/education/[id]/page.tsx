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

  // 현재 사용자 역할 조회
  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  // 게시물 조회 (작성자 정보 포함)
  const { data: post, error } = await supabase
    .from('educational_posts')
    .select('*, users!educational_posts_author_id_fkey(username, nickname)')
    .eq('id', id)
    .single()

  if (error || !post) {
    notFound()
  }

  // 관련 테스트 문제 조회
  const { data: relatedQuestions } = await supabase
    .from('test_questions')
    .select('id, question, question_type, question_image_url, options, correct_answer, max_score')
    .eq('related_post_id', id)

  // 댓글 조회 (작성자 정보 포함)
  const { data: comments } = await supabase
    .from('education_comments')
    .select('*, users!education_comments_author_id_fkey(username, nickname)')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  // 닉네임 목록 조회 (users 테이블에서 nickname이 있는 사용자)
  const { data: nicknameUsers } = await supabase
    .from('users')
    .select('nickname')
    .not('nickname', 'is', null)

  const nicknames = (nicknameUsers || [])
    .map((u: any) => u.nickname)
    .filter((n: string | null): n is string => !!n)

  return (
    <PostDetail
      post={{
        ...post,
        author_name: (post as any).display_nickname || (post as any).users?.nickname || (post as any).users?.username || '알 수 없음',
      }}
      userId={user.id}
      userRole={userData?.role || 'manager'}
      hasRelatedTest={(relatedQuestions?.length || 0) > 0}
      relatedQuestions={(relatedQuestions || []).map(q => ({
        ...q,
        options: q.options as string[] | null,
        correct_answer: Array.isArray(q.correct_answer)
          ? (q.correct_answer as number[])
          : q.correct_answer !== null && q.correct_answer !== undefined
          ? [q.correct_answer as unknown as number]
          : null,
      }))}
      comments={(comments || []).map((c: any) => ({
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        author_name: c.users?.nickname || c.users?.username || '알 수 없음',
        content: c.content,
        display_nickname: c.display_nickname,
        created_at: c.created_at,
      }))}
      nicknames={nicknames}
    />
  )
}
