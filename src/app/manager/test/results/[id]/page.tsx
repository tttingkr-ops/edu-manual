// Created: 2026-02-14 12:00:00
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TestResultPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch test result
  const { data: result } = await supabase
    .from('test_results')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!result) redirect('/manager/test')

  // Fetch subjective answers with admin feedback for this test result
  const { data: subjectiveAnswers } = await supabase
    .from('subjective_answers')
    .select('*, test_questions(question, max_score, category)')
    .eq('test_result_id', id)

  // Parse admin feedback JSON
  const parseAdminFeedback = (feedback: string | null) => {
    if (!feedback) return null
    try {
      return JSON.parse(feedback)
    } catch {
      return { note: feedback }
    }
  }

  const categoryTitle = result.category === '전체' ? '전체 테스트' : result.category.replace(/_/g, ' ')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/manager/test"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          테스트 목록
        </Link>
      </div>

      {/* Result header */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{categoryTitle}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {new Date(result.test_date).toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>
        <div className={`text-5xl font-bold mb-2 ${
          result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {result.score}점
        </div>
        <p className="text-gray-500">
          {result.correct_count}/{result.total_count} 정답
        </p>
      </div>

      {/* Subjective answers with admin feedback */}
      {subjectiveAnswers && subjectiveAnswers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">주관식 답변 및 피드백</h2>
          <div className="space-y-4">
            {subjectiveAnswers.map((sa: any) => {
              const feedback = parseAdminFeedback(sa.admin_feedback)
              return (
                <div key={sa.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">{sa.test_questions?.question}</p>

                  {/* User answer */}
                  <div className="mb-3 p-3 bg-white rounded border">
                    <p className="text-sm text-gray-500 mb-1">내 답변:</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{sa.answer_text || '(답변 없음)'}</p>
                  </div>

                  {/* Scores */}
                  <div className="flex items-center gap-4 mb-3">
                    {sa.ai_score !== null && (
                      <span className="text-sm text-purple-600">AI 점수: {sa.ai_score}/{sa.test_questions?.max_score}</span>
                    )}
                    {sa.final_score !== null && (
                      <span className="text-sm font-bold text-primary-600">최종 점수: {sa.final_score}/{sa.test_questions?.max_score}</span>
                    )}
                    {sa.status === 'admin_reviewed' && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">검토 완료</span>
                    )}
                  </div>

                  {/* Admin structured feedback */}
                  {feedback && sa.status === 'admin_reviewed' && (
                    <div className="space-y-2">
                      {feedback.strengths && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm font-medium text-green-700 mb-1">잘한 점</p>
                          <p className="text-sm text-green-800">{feedback.strengths}</p>
                        </div>
                      )}
                      {feedback.improvements && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                          <p className="text-sm font-medium text-amber-700 mb-1">보완할 점</p>
                          <p className="text-sm text-amber-800">{feedback.improvements}</p>
                        </div>
                      )}
                      {feedback.note && !feedback.strengths && !feedback.improvements && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-800">{feedback.note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
