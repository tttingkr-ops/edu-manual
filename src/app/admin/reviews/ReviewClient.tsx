// Created: 2026-02-01 20:55:00
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Answer {
  id: string
  question_id: string
  user_id: string
  answer_text: string | null
  image_url: string | null
  ai_score: number | null
  ai_feedback: string | null
  status: 'pending' | 'ai_graded' | 'admin_reviewed'
  created_at: string
  test_questions: {
    id: string
    question: string
    max_score: number
    grading_criteria: string | null
    model_answer: string | null
    category: string
  }
  users: {
    id: string
    name: string | null
    username: string
  }
}

interface ReviewClientProps {
  answers: Answer[]
  adminId: string
}

export default function ReviewClient({ answers: initialAnswers, adminId }: ReviewClientProps) {
  const supabase = createClient()
  const [answers, setAnswers] = useState(initialAnswers)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adminScore, setAdminScore] = useState<number>(0)
  const [adminFeedback, setAdminFeedback] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleExpand = (answerId: string) => {
    if (expandedId === answerId) {
      setExpandedId(null)
      setEditingId(null)
    } else {
      setExpandedId(answerId)
      const answer = answers.find(a => a.id === answerId)
      if (answer) {
        setAdminScore(answer.ai_score || 0)
        setAdminFeedback('')
      }
    }
  }

  const handleStartEdit = (answer: Answer) => {
    setEditingId(answer.id)
    setAdminScore(answer.ai_score || 0)
    setAdminFeedback('')
  }

  const handleApproveAiScore = async (answer: Answer) => {
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('subjective_answers')
        .update({
          admin_score: answer.ai_score,
          admin_feedback: 'AI 채점 승인',
          admin_reviewed_at: new Date().toISOString(),
          admin_reviewer_id: adminId,
          final_score: answer.ai_score,
          status: 'admin_reviewed',
        })
        .eq('id', answer.id)

      if (error) throw error

      // 목록에서 제거
      setAnswers(prev => prev.filter(a => a.id !== answer.id))
      setExpandedId(null)
    } catch (error) {
      console.error('Error approving score:', error)
      alert('점수 승인 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitReview = async (answerId: string, maxScore: number) => {
    if (adminScore < 0 || adminScore > maxScore) {
      alert(`점수는 0~${maxScore} 사이여야 합니다.`)
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('subjective_answers')
        .update({
          admin_score: adminScore,
          admin_feedback: adminFeedback || null,
          admin_reviewed_at: new Date().toISOString(),
          admin_reviewer_id: adminId,
          final_score: adminScore,
          status: 'admin_reviewed',
        })
        .eq('id', answerId)

      if (error) throw error

      // 목록에서 제거
      setAnswers(prev => prev.filter(a => a.id !== answerId))
      setExpandedId(null)
      setEditingId(null)
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('검토 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const parseAiFeedback = (feedback: string | null) => {
    if (!feedback) return null
    try {
      return JSON.parse(feedback)
    } catch {
      return { feedback }
    }
  }

  if (answers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          검토할 답변이 없습니다
        </h2>
        <p className="text-gray-600">
          모든 주관식 답변이 검토 완료되었습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {answers.map((answer) => {
        const aiFeedback = parseAiFeedback(answer.ai_feedback)
        const isExpanded = expandedId === answer.id
        const isEditing = editingId === answer.id

        return (
          <div
            key={answer.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* 헤더 */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleExpand(answer.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    answer.status === 'ai_graded'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {answer.status === 'ai_graded' ? 'AI 채점 완료' : '대기 중'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {answer.users?.name || answer.users?.username || '알 수 없음'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {answer.test_questions?.category?.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {answer.ai_score !== null && (
                    <span className="text-lg font-bold text-purple-600">
                      AI: {answer.ai_score}/{answer.test_questions?.max_score}점
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 상세 내용 */}
            {isExpanded && (
              <div className="border-t border-gray-200 p-6 space-y-6">
                {/* 문제 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">문제</h4>
                  <p className="text-gray-900">{answer.test_questions?.question}</p>
                </div>

                {/* 채점 기준 */}
                {answer.test_questions?.grading_criteria && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">채점 기준</h4>
                    <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded">
                      {answer.test_questions.grading_criteria}
                    </p>
                  </div>
                )}

                {/* 모범 답안 */}
                {answer.test_questions?.model_answer && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">모범 답안</h4>
                    <p className="text-gray-700 text-sm bg-green-50 p-3 rounded border border-green-200">
                      {answer.test_questions.model_answer}
                    </p>
                  </div>
                )}

                {/* 학생 답변 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">학생 답변</h4>
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {answer.answer_text || '(텍스트 답변 없음)'}
                    </p>
                    {answer.image_url && (
                      <img
                        src={answer.image_url}
                        alt="첨부 이미지"
                        className="mt-3 max-h-60 rounded border"
                      />
                    )}
                  </div>
                </div>

                {/* AI 채점 결과 */}
                {aiFeedback && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">AI 채점 결과</h4>
                    <div className="bg-purple-50 p-4 rounded border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-purple-700">
                          {answer.ai_score}/{answer.test_questions?.max_score}점
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{aiFeedback.feedback}</p>

                      {aiFeedback.strengths?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-green-700">잘한 점:</p>
                          <ul className="list-disc list-inside text-sm text-green-600">
                            {aiFeedback.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}

                      {aiFeedback.improvements?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-amber-700">개선할 점:</p>
                          <ul className="list-disc list-inside text-sm text-amber-600">
                            {aiFeedback.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 관리자 검토 */}
                {!isEditing ? (
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleApproveAiScore(answer)}
                      disabled={isSubmitting || answer.ai_score === null}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      AI 점수 승인
                    </button>
                    <button
                      onClick={() => handleStartEdit(answer)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      점수 조정
                    </button>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-gray-200 space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium text-gray-700">
                        최종 점수:
                      </label>
                      <input
                        type="number"
                        value={adminScore}
                        onChange={(e) => setAdminScore(parseInt(e.target.value) || 0)}
                        min={0}
                        max={answer.test_questions?.max_score || 10}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-gray-500">
                        / {answer.test_questions?.max_score}점
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        관리자 피드백 (선택)
                      </label>
                      <textarea
                        value={adminFeedback}
                        onChange={(e) => setAdminFeedback(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        rows={3}
                        placeholder="추가 피드백이 있다면 입력하세요..."
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSubmitReview(answer.id, answer.test_questions?.max_score || 10)}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? '저장 중...' : '검토 완료'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
