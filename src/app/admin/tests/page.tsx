// Created: 2026-01-27 17:40:00
// Updated: 2026-01-29 - Supabase 실제 연동
import { createClient } from '@/lib/supabase/server'
import TestsContent from './TestsContent'

export default async function TestsPage() {
  const supabase = await createClient()

  // 테스트 문제 조회
  const { data: questions } = await supabase
    .from('test_questions')
    .select('*')
    .order('category', { ascending: true })

  // options 타입을 string[]로 변환
  const formattedQuestions = (questions || []).map(q => ({
    ...q,
    options: (q.options as string[]) || [],
  }))

  return <TestsContent questions={formattedQuestions} />
}
