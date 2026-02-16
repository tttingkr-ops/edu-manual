// Created: 2026-01-27 17:35:00
// Updated: 2026-02-01 - 주관식 문제 지원 및 AI 채점 연동
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Parse question_image_url - handles both single URL (legacy) and JSON array
function parseQuestionImages(val: string | null): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : [val]
  } catch {
    return val ? [val] : []
  }
}

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

interface SubjectiveAnswer {
  text: string
  imageUrl: string | null
  imagePath: string | null
}

interface GradingResult {
  score: number
  maxScore: number
  feedback: string
  strengths: string[]
  improvements: string[]
}

interface TestContentProps {
  questions: Question[]
  category: string
  categoryTitle: string
  userId: string
  retestInfo?: { id: string; reason: string | null; category: string | null } | null
}

export default function TestContent({
  questions,
  category,
  categoryTitle,
  userId,
  retestInfo,
}: TestContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [multipleChoiceAnswers, setMultipleChoiceAnswers] = useState<(number | null)[]>(
    new Array(questions.length).fill(null)
  )
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<string, SubjectiveAnswer>>({})
  const [gradingResults, setGradingResults] = useState<Record<string, GradingResult>>({})
  const [gradingInProgress, setGradingInProgress] = useState<Set<string>>(new Set())
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [gradingErrors, setGradingErrors] = useState<Record<string, string>>({})
  const [savedResultId, setSavedResultId] = useState<string | null>(null)

  const currentQuestion = questions[currentIndex]
  const isMultipleChoice = currentQuestion?.question_type === 'multiple_choice'

  // 답변 완료 수 계산
  const getAnsweredCount = () => {
    let count = 0
    questions.forEach((q, index) => {
      if (q.question_type === 'multiple_choice') {
        if (multipleChoiceAnswers[index] !== null) count++
      } else {
        const answer = subjectiveAnswers[q.id]
        if (answer && (answer.text.trim() || answer.imageUrl)) count++
      }
    })
    return count
  }

  const answeredCount = getAnsweredCount()
  const progress = (answeredCount / questions.length) * 100

  // 객관식 답변 선택
  const handleMultipleChoiceAnswer = (optionIndex: number) => {
    const newAnswers = [...multipleChoiceAnswers]
    newAnswers[currentIndex] = optionIndex
    setMultipleChoiceAnswers(newAnswers)
  }

  // 주관식 텍스트 답변
  const handleSubjectiveText = (questionId: string, text: string) => {
    setSubjectiveAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        text,
        imageUrl: prev[questionId]?.imageUrl || null,
        imagePath: prev[questionId]?.imagePath || null,
      }
    }))
  }

  // 주관식 이미지 업로드
  const handleImageUpload = (questionId: string, url: string, path: string) => {
    setSubjectiveAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        text: prev[questionId]?.text || '',
        imageUrl: url || null,
        imagePath: path || null,
      }
    }))
  }

  // AI 채점 요청
  const gradeSubjectiveAnswer = async (questionId: string) => {
    const answer = subjectiveAnswers[questionId]
    if (!answer || (!answer.text.trim() && !answer.imageUrl)) return

    setGradingInProgress(prev => new Set(prev).add(questionId))

    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answerText: answer.text,
          imageUrl: answer.imageUrl,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error('AI 채점 요청 실패')
      }

      const data = await response.json()
      setGradingResults(prev => ({
        ...prev,
        [questionId]: data.result,
      }))
    } catch (error) {
      console.error('Grading error:', error)
      setGradingErrors(prev => ({
        ...prev,
        [questionId]: 'AI 채점에 실패했습니다. 다시 시도해주세요.',
      }))
    } finally {
      setGradingInProgress(prev => {
        const next = new Set(prev)
        next.delete(questionId)
        return next
      })
    }
  }

  // 이전/다음 문제
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1)
  }

  // 테스트 제출
  const handleSubmit = async () => {
    if (answeredCount < questions.length) {
      if (!confirm(`아직 ${questions.length - answeredCount}문제를 풀지 않았습니다. 제출하시겠습니까?`)) {
        return
      }
    }

    setIsSubmitting(true)
    setSaveError(null)

    // 모든 주관식 문제 AI 채점 요청
    const subjectiveQuestions = questions.filter(q => q.question_type === 'subjective')
    const gradingPromises = subjectiveQuestions
      .filter(q => {
        const answer = subjectiveAnswers[q.id]
        return answer && (answer.text.trim() || answer.imageUrl) && !gradingResults[q.id]
      })
      .map(q => gradeSubjectiveAnswer(q.id))

    if (gradingPromises.length > 0) {
      await Promise.all(gradingPromises)
    }

    // 결과 계산
    const { correctCount, totalScore, maxTotalScore } = calculateResult()
    const score = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0

    try {
      // DB에 결과 저장
      const { data: resultData, error } = await supabase.from('test_results').insert({
        user_id: userId,
        category: category,
        score: score,
        correct_count: correctCount,
        total_count: questions.length,
        category_scores: {},
        test_date: new Date().toISOString(),
      }).select('id').single()

      if (error) {
        console.error('Error saving test result:', error)
        setSaveError('결과 저장 중 오류가 발생했습니다.')
      } else if (resultData) {
        setSavedResultId(resultData.id)
      }

      // 재테스트인 경우 완료 처리
      if (retestInfo) {
        await supabase
          .from('retest_assignments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', retestInfo.id)
      }
    } catch (err) {
      console.error('Error saving test result:', err)
      setSaveError('결과 저장 중 오류가 발생했습니다.')
    }

    setShowResult(true)
  }

  // 결과 계산
  const calculateResult = () => {
    let correctCount = 0
    let totalScore = 0
    let maxTotalScore = 0
    const wrongAnswers: { question: Question; userAnswer: number | null }[] = []

    questions.forEach((q, index) => {
      if (q.question_type === 'multiple_choice') {
        maxTotalScore += q.max_score
        if (multipleChoiceAnswers[index] === q.correct_answer) {
          correctCount++
          totalScore += q.max_score
        } else {
          wrongAnswers.push({ question: q, userAnswer: multipleChoiceAnswers[index] })
        }
      } else {
        maxTotalScore += q.max_score
        const grading = gradingResults[q.id]
        if (grading) {
          totalScore += grading.score
          if (grading.score >= q.max_score * 0.6) {
            correctCount++
          }
        }
      }
    })

    const score = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0
    return { correctCount, score, wrongAnswers, totalScore, maxTotalScore }
  }

  // 문제가 없는 경우
  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">문제가 없습니다</h1>
          <p className="text-gray-600 mb-6">해당 카테고리에 등록된 테스트 문제가 없습니다.</p>
          <Link
            href="/manager/test"
            className="inline-flex px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            테스트 목록으로
          </Link>
        </div>
      </div>
    )
  }

  // 결과 화면
  if (showResult) {
    const { correctCount, score, wrongAnswers, totalScore, maxTotalScore } = calculateResult()

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 결과 헤더 */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <div
            className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl mb-4 ${
              score >= 80 ? 'bg-green-100' : score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
            }`}
          >
            {score >= 80 ? '🎉' : score >= 60 ? '👍' : '📚'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">테스트 완료!</h1>
          <p className="text-gray-600 mb-6">{categoryTitle}</p>

          <div
            className={`text-5xl font-bold mb-2 ${
              score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}
          >
            {score}점
          </div>
          <p className="text-gray-500">
            총 {maxTotalScore}점 중 {totalScore}점 획득 ({correctCount}/{questions.length} 문제)
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/manager/test"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              테스트 목록
            </Link>
            <button
              onClick={() => {
                setShowResult(false)
                setCurrentIndex(0)
                setMultipleChoiceAnswers(new Array(questions.length).fill(null))
                setSubjectiveAnswers({})
                setGradingResults({})
                setIsSubmitting(false)
                setSavedResultId(null)
              }}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              다시 풀기
            </button>
            {wrongAnswers.length > 0 && savedResultId && (
              <Link
                href={`/manager/test/review?resultId=${savedResultId}`}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                오답 복습
              </Link>
            )}
          </div>
        </div>

        {/* 객관식 오답 노트 */}
        {wrongAnswers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              객관식 오답 노트 ({wrongAnswers.length}문제)
            </h2>
            <div className="space-y-4">
              {wrongAnswers.map(({ question, userAnswer }, index) => (
                <div key={question.id} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                  <p className="font-medium text-gray-900 mb-3">
                    {index + 1}. {question.question}
                  </p>
                  <div className="space-y-2 text-sm">
                    {question.options?.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`p-2 rounded ${
                          optIndex === question.correct_answer
                            ? 'bg-green-100 text-green-800 font-medium'
                            : optIndex === userAnswer
                            ? 'bg-red-100 text-red-800 line-through'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {optIndex + 1}. {option}
                        {optIndex === question.correct_answer && ' ✓ 정답'}
                        {optIndex === userAnswer && optIndex !== question.correct_answer && ' ✗ 오답'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 주관식 결과 */}
        {questions.filter(q => q.question_type === 'subjective').length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              주관식 AI 채점 결과
            </h2>
            <div className="space-y-4">
              {questions
                .filter(q => q.question_type === 'subjective')
                .map((question) => {
                  const result = gradingResults[question.id]
                  const answer = subjectiveAnswers[question.id]

                  return (
                    <div key={question.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="font-medium text-gray-900 mb-2">{question.question}</p>

                      {/* 내 답변 */}
                      <div className="mb-3 p-3 bg-white rounded border">
                        <p className="text-sm text-gray-500 mb-1">내 답변:</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{answer?.text || '(답변 없음)'}</p>
                        {answer?.imageUrl && (
                          <img src={answer.imageUrl} alt="첨부 이미지" className="mt-2 max-h-40 rounded" />
                        )}
                      </div>

                      {/* 채점 결과 */}
                      {result ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-primary-600">
                              {result.score}/{result.maxScore}점
                            </span>
                          </div>
                          <p className="text-gray-700">{result.feedback}</p>

                          {result.strengths.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-green-700">잘한 점:</p>
                              <ul className="list-disc list-inside text-sm text-green-600">
                                {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}

                          {result.improvements.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-amber-700">개선할 점:</p>
                              <ul className="list-disc list-inside text-sm text-amber-600">
                                {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">채점 결과 없음</p>
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

  // 테스트 화면
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 상단 정보 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/manager/test"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          나가기
        </Link>
        <div className="text-sm text-gray-500">{categoryTitle}</div>
      </div>

      {/* 재테스트 배지 */}
      {retestInfo && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">재테스트</span>
            <span className="text-sm font-medium text-red-800">관리자가 할당한 재테스트입니다</span>
          </div>
          {retestInfo.reason && (
            <p className="text-sm text-red-700 mt-1">사유: {retestInfo.reason}</p>
          )}
        </div>
      )}

      {/* 진행률 */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>{currentIndex + 1} / {questions.length} 문제</span>
          <span>{answeredCount}문제 답변 완료</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {/* 문제 유형 태그 */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-block px-3 py-1 text-sm rounded-full ${
            isMultipleChoice
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          }`}>
            {isMultipleChoice ? '객관식' : '주관식'}
          </span>
          <span className="text-sm text-gray-500">
            {currentQuestion.max_score}점
          </span>
          {currentQuestion.sub_category && (
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
              {currentQuestion.sub_category}
            </span>
          )}
        </div>

        {/* 문제 */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Q{currentIndex + 1}. {currentQuestion.question}
        </h2>

        {/* 문제 이미지 (복수 지원) */}
        {parseQuestionImages(currentQuestion.question_image_url).length > 0 && (
          <div className="mb-6 space-y-3">
            {parseQuestionImages(currentQuestion.question_image_url).map((imgUrl, i) => (
              <img
                key={i}
                src={imgUrl}
                alt={`문제 상황 이미지 ${i + 1}`}
                className="max-w-full rounded-lg border border-gray-200 shadow-sm"
              />
            ))}
            <p className="text-sm text-gray-500 text-center">위 상황을 보고 답변해주세요.</p>
          </div>
        )}

        {/* 객관식 선택지 */}
        {isMultipleChoice && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleMultipleChoiceAnswer(index)}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  multipleChoiceAnswers[currentIndex] === index
                    ? 'border-primary-500 bg-primary-50 text-primary-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      multipleChoiceAnswers[currentIndex] === index
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 주관식 답변 */}
        {!isMultipleChoice && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                답변 작성
              </label>
              <textarea
                value={subjectiveAnswers[currentQuestion.id]?.text || ''}
                onChange={(e) => handleSubjectiveText(currentQuestion.id, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={6}
                placeholder="답변을 입력하세요..."
              />
            </div>

            {/* AI 채점 버튼 */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => gradeSubjectiveAnswer(currentQuestion.id)}
                disabled={
                  gradingInProgress.has(currentQuestion.id) ||
                  (!subjectiveAnswers[currentQuestion.id]?.text.trim() &&
                    !subjectiveAnswers[currentQuestion.id]?.imageUrl)
                }
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {gradingInProgress.has(currentQuestion.id) ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    AI 채점 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI 미리 채점
                  </>
                )}
              </button>
            </div>

            {/* AI 채점 에러 표시 */}
            {gradingErrors[currentQuestion.id] && !gradingResults[currentQuestion.id] && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{gradingErrors[currentQuestion.id]}</p>
              </div>
            )}

            {/* AI 채점 결과 미리보기 */}
            {gradingResults[currentQuestion.id] && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-purple-700">
                    AI 예상 점수: {gradingResults[currentQuestion.id].score}/{gradingResults[currentQuestion.id].maxScore}점
                  </span>
                </div>
                <p className="text-gray-700 text-sm">{gradingResults[currentQuestion.id].feedback}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 문제 네비게이션 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {questions.map((q, index) => {
          const isAnswered = q.question_type === 'multiple_choice'
            ? multipleChoiceAnswers[index] !== null
            : !!(subjectiveAnswers[q.id]?.text.trim() || subjectiveAnswers[q.id]?.imageUrl)

          return (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                index === currentIndex
                  ? 'bg-primary-600 text-white'
                  : isAnswered
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {index + 1}
            </button>
          )
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </button>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              채점 중...
            </>
          ) : (
            '제출하기'
          )}
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === questions.length - 1}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
