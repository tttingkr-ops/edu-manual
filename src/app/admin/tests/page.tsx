// Created: 2026-01-27 17:40:00
import { createClient } from '@/lib/supabase/server'
import TestsContent from './TestsContent'
import { mockTestQuestions } from '@/lib/mock-data'

export default async function TestsPage() {
  const supabase = await createClient()

  // 테스트 문제 조회 (Mock 모드에서는 mockTestQuestions 사용)
  const { data: questions } = await supabase
    .from('test_questions')
    .select('*')
    .order('category', { ascending: true })

  return <TestsContent questions={questions || mockTestQuestions} />
}
