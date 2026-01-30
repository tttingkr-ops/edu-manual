// Created: 2026-01-27 17:35:00
// Updated: 2026-01-29 - Supabase 연동, Mock 제거
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

  // 문제 조회
  interface Question {
    id: string
    category: string
    sub_category: string | null
    question: string
    options: string[]
    correct_answer: number
    related_post_id: string | null
  }

  let questions: Question[] = []

  if (decodedCategory === '전체') {
    // 전체 테스트: 모든 카테고리에서 랜덤으로 20문제
    const { data } = await supabase
      .from('test_questions')
      .select('*')

    if (data) {
      const shuffled = [...data].sort(() => Math.random() - 0.5)
      questions = shuffled.slice(0, 20).map(q => ({
        ...q,
        options: (q.options as string[]) || [],
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
      options: (q.options as string[]) || [],
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
