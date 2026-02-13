// Created: 2026-01-27 17:35:00
// Updated: 2026-02-01 - 주관식 문제 지원 (question_type, max_score 등 추가)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TestContent from './TestContent'

interface PageProps {
  params: Promise<{ category: string }>
}

export default async function TestPage({ params }: PageProps) {
  const { category } = await params
  const decodedCategory = decodeURIComponent(category)
  const supabase = await createClient()

  // 현재 사용자 조회
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 그룹 조회 → 허용 카테고리 계산
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select('group_id, groups(name)')
    .eq('user_id', user.id)

  const userGroupNames = (userGroups || []).map((ug: any) => ug.groups?.name).filter(Boolean)
  const allowedCategories = userGroupNames.length > 0
    ? userGroupNames.map((name: string) => name.replace(/ /g, '_'))
    : null // null = 모든 카테고리

  // 카테고리 접근 권한 검증 ("전체"는 항상 허용)
  if (decodedCategory !== '전체' && allowedCategories && !allowedCategories.includes(decodedCategory)) {
    redirect('/manager/test')
  }

  // 문제 조회
  interface Question {
    id: string
    category: string
    sub_category: string | null
    question: string
    question_type: 'multiple_choice' | 'subjective'
    question_image_url: string | null
    options: string[] | null
    correct_answer: number | null
    max_score: number
    grading_criteria: string | null
    model_answer: string | null
    related_post_id: string | null
  }

  let questions: Question[] = []

  if (decodedCategory === '전체') {
    // 전체 테스트: 허용 카테고리에서 랜덤으로 20문제
    let query = supabase.from('test_questions').select('*')
    if (allowedCategories) {
      query = query.in('category', allowedCategories)
    }
    const { data } = await query

    if (data) {
      const shuffled = [...data].sort(() => Math.random() - 0.5)
      questions = shuffled.slice(0, 20).map(q => ({
        ...q,
        question_type: q.question_type || 'multiple_choice',
        question_image_url: q.question_image_url || null,
        options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
        max_score: q.max_score || 10,
      }))
    }
  } else {
    // 카테고리별 테스트
    const { data } = await supabase
      .from('test_questions')
      .select('*')
      .eq('category', decodedCategory)

    questions = (data || []).map(q => ({
      ...q,
      question_type: q.question_type || 'multiple_choice',
      question_image_url: q.question_image_url || null,
      options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
      max_score: q.max_score || 10,
    }))
  }

  const categoryTitle =
    decodedCategory === '전체'
      ? '전체 테스트'
      : decodedCategory.replace(/_/g, ' ')

  return (
    <TestContent
      questions={questions}
      category={decodedCategory}
      categoryTitle={categoryTitle}
      userId={user.id}
    />
  )
}
