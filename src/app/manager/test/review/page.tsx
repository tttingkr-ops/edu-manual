// Created: 2026-02-14 12:00:00
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewContent from './ReviewContent'

interface PageProps {
  searchParams: Promise<{ resultId?: string; questions?: string }>
}

export default async function ReviewPage({ searchParams }: PageProps) {
  const { resultId, questions: questionIds } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!resultId) redirect('/manager/test')

  // 테스트 결과 조회
  const { data: testResult } = await supabase
    .from('test_results')
    .select('*')
    .eq('id', resultId)
    .eq('user_id', user.id)
    .single()

  if (!testResult) redirect('/manager/test')

  // 오답 문제 조회 방식:
  // 1) questionIds가 있으면 해당 문제들만 조회
  // 2) 없으면 해당 카테고리의 모든 문제 조회 (클라이언트에서 오답 판별)
  let wrongQuestions: any[] = []

  if (questionIds) {
    const ids = questionIds.split(',').filter(Boolean)
    if (ids.length > 0) {
      const { data } = await supabase
        .from('test_questions')
        .select('*, educational_posts(id, title)')
        .in('id', ids)

      wrongQuestions = (data || []).map(q => ({
        ...q,
        question_type: q.question_type || 'multiple_choice',
        question_image_url: q.question_image_url || null,
        options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
        max_score: q.max_score || 10,
        relatedPostTitle: q.educational_posts?.title || null,
        relatedPostId: q.educational_posts?.id || null,
      }))
    }
  } else {
    // resultId 기반 - 카테고리의 모든 객관식 문제를 가져와서 클라이언트에서 필터링
    const category = testResult.category
    let query = supabase.from('test_questions').select('*, educational_posts(id, title)')

    if (category !== '전체') {
      query = query.eq('category', category)
    }

    const { data } = await query

    wrongQuestions = (data || []).map(q => ({
      ...q,
      question_type: q.question_type || 'multiple_choice',
      question_image_url: q.question_image_url || null,
      options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
      max_score: q.max_score || 10,
      relatedPostTitle: q.educational_posts?.title || null,
      relatedPostId: q.educational_posts?.id || null,
    }))
  }

  return (
    <ReviewContent
      questions={wrongQuestions}
      testResultId={resultId}
      userId={user.id}
      categoryTitle={testResult.category === '전체' ? '전체 테스트' : testResult.category.replace(/_/g, ' ')}
    />
  )
}
