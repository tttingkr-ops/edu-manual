// Created: 2026-02-14 12:00:00
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function parseQuestionImages(val: string | null): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : [val]
  } catch {
    return val ? [val] : []
  }
}

interface ReviewQuestion {
  id: string
  category: string
  question: string
  question_type: 'multiple_choice' | 'subjective'
  question_image_url: string | null
  options: string[] | null
  correct_answer: number[] | null
  max_score: number
  relatedPostTitle: string | null
  relatedPostId: string | null
}

interface ReviewContentProps {
  questions: ReviewQuestion[]
  testResultId: string
  userId: string
  categoryTitle: string
}

export default function ReviewContent({
  questions,
  testResultId,
  userId,
  categoryTitle,
}: ReviewContentProps) {
  const supabase = createClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[][]>(
    Array.from({ length: questions.length }, () => [])
  )
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 객관식 문제만 필터 (복습은 객관식만 대상)
  const mcQuestions = questions.filter(q => q.question_type === 'multiple_choice')

  if (mcQuestions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">복습할 문제가 없습니다</h1>
          <p className="text-gray-600 mb-6">모든 객관식 문제를 맞추셨습니다!</p>
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

  const currentQuestion = mcQuestions[currentIndex]
  const answeredCount = answers.filter(a => a.length > 0).length
  const progress = (answeredCount / mcQuestions.length) * 100

  const handleAnswer = (optionIndex: number) => {
    const current = answers[currentIndex]
    const next = current.includes(optionIndex)
      ? current.filter(i => i !== optionIndex)
      : [...current, optionIndex].sort((a, b) => a - b)
    const newAnswers = [...answers]
    newAnswers[currentIndex] = next
    setAnswers(newAnswers)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    // 결과 계산
    const answersEqual = (a: number[], b: number[]) => {
      if (a.length !== b.length) return false
      const sa = [...a].sort((x, y) => x - y)
      const sb = [...b].sort((x, y) => x - y)
      return sa.every((v, i) => v === sb[i])
    }

    let correctOnReview = 0
    const reviewResults: { questionId: string; answer: number[]; isCorrect: boolean }[] = []

    mcQuestions.forEach((q, index) => {
      const userAnswer = answers[index]
      const correct = Array.isArray(q.correct_answer)
        ? q.correct_answer
        : q.correct_answer !== null ? [q.correct_answer as unknown as number] : []
      const isCorrect = answersEqual(userAnswer, correct)
      if (isCorrect) correctOnReview++
      reviewResults.push({ questionId: q.id, answer: userAnswer, isCorrect })
    })

    // wrong_answer_reviews에 저장
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inserts: any[] = reviewResults.map(r => ({
        user_id: userId,
        test_result_id: testResultId,
        question_id: r.questionId,
        original_answer: null,
        review_answer: { selected: r.answer },
        is_correct_on_review: r.isCorrect,
      }))

      await supabase.from('wrong_answer_reviews').insert(inserts)
    } catch (err) {
      console.error('Error saving review results:', err)
    }

    setShowResult(true)
    setIsSubmitting(false)
  }

  // 결과 화면
  if (showResult) {
    const answersEqual = (a: number[], b: number[]) => {
      if (a.length !== b.length) return false
      const sa = [...a].sort((x, y) => x - y)
      const sb = [...b].sort((x, y) => x - y)
      return sa.every((v, i) => v === sb[i])
    }
    let correctOnReview = 0
    mcQuestions.forEach((q, index) => {
      const correct = Array.isArray(q.correct_answer)
        ? q.correct_answer
        : q.correct_answer !== null ? [q.correct_answer as unknown as number] : []
      if (answersEqual(answers[index], correct)) correctOnReview++
    })
    const score = Math.round((correctOnReview / mcQuestions.length) * 100)

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl mb-4 ${
            score >= 80 ? 'bg-green-100' : score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            {score >= 80 ? '🎉' : score >= 60 ? '👍' : '📚'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">오답 복습 완료!</h1>
          <p className="text-gray-600 mb-6">{categoryTitle} 오답 복습</p>

          <div className={`text-5xl font-bold mb-2 ${
            score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {score}점
          </div>
          <p className="text-gray-500">
            {mcQuestions.length}문제 중 {correctOnReview}문제 정답
          </p>

          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/manager/test"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              테스트 목록
            </Link>
          </div>
        </div>

        {/* 문제별 결과 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">문제별 결과</h2>
          <div className="space-y-4">
            {mcQuestions.map((q, index) => {
              const userAnswer = answers[index]
              const correct = Array.isArray(q.correct_answer)
                ? q.correct_answer
                : q.correct_answer !== null ? [q.correct_answer as unknown as number] : []
              const isCorrect = answersEqual(userAnswer, correct)

              return (
                <div key={q.id} className={`p-4 rounded-lg border ${
                  isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-900">
                      {index + 1}. {q.question}
                    </p>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {isCorrect ? '정답' : '오답'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {q.options?.map((option, optIndex) => {
                      const optIsCorrect = correct.includes(optIndex)
                      const optIsSelected = userAnswer.includes(optIndex)
                      return (
                      <div key={optIndex} className={`p-2 rounded ${
                        optIsCorrect
                          ? 'bg-green-100 text-green-800 font-medium'
                          : optIsSelected && !optIsCorrect
                          ? 'bg-red-100 text-red-800 line-through'
                          : 'text-gray-600'
                      }`}>
                        {optIndex + 1}. {option}
                        {optIsCorrect && ' ✓'}
                      </div>
                      )
                    })}
                  </div>
                  {q.relatedPostId && (
                    <Link
                      href={`/manager/education/${q.relatedPostId}`}
                      className="inline-flex items-center gap-1 mt-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      관련 교육 자료: {q.relatedPostTitle}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // 복습 문제 풀기 화면
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 상단 */}
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
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">오답 복습</span>
          <span className="text-sm text-gray-500">{categoryTitle}</span>
        </div>
      </div>

      {/* 진행률 */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>{currentIndex + 1} / {mcQuestions.length} 문제</span>
          <span>{answeredCount}문제 답변 완료</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700">
            객관식
          </span>
          <span className="text-sm text-gray-500">{currentQuestion.max_score}점</span>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Q{currentIndex + 1}. {currentQuestion.question}
        </h2>

        {/* 이미지 */}
        {parseQuestionImages(currentQuestion.question_image_url).length > 0 && (
          <div className="mb-6 space-y-3">
            {parseQuestionImages(currentQuestion.question_image_url).map((imgUrl, i) => (
              <img key={i} src={imgUrl} alt={`문제 이미지 ${i + 1}`}
                className="max-w-full rounded-lg border border-gray-200 shadow-sm" />
            ))}
          </div>
        )}

        {/* 선택지 */}
        {currentQuestion.options && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-1">복수 선택 가능 (해당하는 답을 모두 선택하세요)</p>
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  answers[currentIndex].includes(index)
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    answers[currentIndex].includes(index)
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 관련 교육 자료 링크 */}
        {currentQuestion.relatedPostId && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Link
              href={`/manager/education/${currentQuestion.relatedPostId}`}
              target="_blank"
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              관련 교육 자료 보기: {currentQuestion.relatedPostTitle}
            </Link>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {mcQuestions.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
              index === currentIndex
                ? 'bg-amber-600 text-white'
                : answers[index].length > 0
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
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
          className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '제출 중...' : '제출하기'}
        </button>

        <button
          onClick={() => currentIndex < mcQuestions.length - 1 && setCurrentIndex(currentIndex + 1)}
          disabled={currentIndex === mcQuestions.length - 1}
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
