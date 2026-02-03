// Created: 2026-01-27 17:40:00
// Updated: 2026-02-01 - 주관식 문제 지원 추가
import { createClient } from '@/lib/supabase/server'
import TestsContent from './TestsContent'

export default async function TestsPage() {
  const supabase = await createClient()

  // 테스트 문제 조회
  const { data: questions } = await supabase
    .from('test_questions')
    .select('*')
    .order('category', { ascending: true })

  // 타입 변환
  const formattedQuestions = (questions || []).map(q => ({
    ...q,
    question_type: q.question_type || 'multiple_choice',
    options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
    max_score: q.max_score || 10,
  }))

  return <TestsContent questions={formattedQuestions} />
}
