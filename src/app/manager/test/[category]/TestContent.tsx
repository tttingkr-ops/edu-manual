// Created: 2026-01-27 17:35:00
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: string
  category: string
  sub_category: string | null
  question: string
  options: string[]
  correct_answer: number
  related_post_id: string | null
}

interface TestContentProps {
  questions: Question[]
  category: string
  categoryTitle: string
}

export default function TestContent({
  questions,
  category,
  categoryTitle,
}: TestContentProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(questions.length).fill(null)
  )
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentQuestion = questions[currentIndex]
  const answeredCount = answers.filter((a) => a !== null).length
  const progress = (answeredCount / questions.length) * 100

  // 답변 선택
  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers]
    newAnswers[currentIndex] = optionIndex
    setAnswers(newAnswers)
  }

  // 이전 문제
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  // 다음 문제
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  // 테스트 제출
  const handleSubmit = async () => {
    if (answeredCount < questions.length) {
      if (!confirm(`아직 ${questions.length - answeredCount}문제를 풀지 않았습니다. 제출하시겠습니까?`)) {
        return
      }
    }

    setIsSubmitting(true)
    setShowResult(true)
  }

  // 결과 계산
  const calculateResult = () => {
    let correctCount = 0
    const wrongAnswers: { question: Question; userAnswer: number | null }[] = []

    questions.forEach((q, index) => {
      if (answers[index] === q.correct_answer) {
        correctCount++
      } else {
        wrongAnswers.push({ question: q, userAnswer: answers[index] })
      }
    })

    const score = Math.round((correctCount / questions.length) * 100)

    return { correctCount, score, wrongAnswers }
  }

  // 결과 화면
  if (showResult) {
    const { correctCount, score, wrongAnswers } = calculateResult()

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 결과 헤더 */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <div
            className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl mb-4 ${
              score >= 80
                ? 'bg-green-100'
                : score >= 60
                ? 'bg-yellow-100'
                : 'bg-red-100'
            }`}
          >
            {score >= 80 ? '🎉' : score >= 60 ? '👍' : '📚'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            테스트 완료!
          </h1>
          <p className="text-gray-600 mb-6">{categoryTitle}</p>

          <div
            className={`text-5xl font-bold mb-2 ${
              score >= 80
                ? 'text-green-600'
                : score >= 60
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {score}점
          </div>
          <p className="text-gray-500">
            {questions.length}문제 중 {correctCount}문제 정답
          </p>

          <div className="mt-6 flex items-center justify-center gap-4">
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
                setAnswers(new Array(questions.length).fill(null))
                setIsSubmitting(false)
              }}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              다시 풀기
            </button>
          </div>
        </div>

        {/* 틀린 문제 리뷰 */}
        {wrongAnswers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              오답 노트 ({wrongAnswers.length}문제)
            </h2>
            <div className="space-y-4">
              {wrongAnswers.map(({ question, userAnswer }, index) => (
                <div
                  key={question.id}
                  className="p-4 bg-red-50 border border-red-100 rounded-lg"
                >
                  <p className="font-medium text-gray-900 mb-3">
                    {index + 1}. {question.question}
                  </p>
                  <div className="space-y-2 text-sm">
                    {question.options.map((option, optIndex) => (
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

        {/* Mock 모드 안내 */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Mock 모드</p>
              <p className="text-sm text-yellow-700">
                테스트 결과는 실제로 저장되지 않습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 문제가 없는 경우
  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            문제가 없습니다
          </h1>
          <p className="text-gray-600 mb-6">
            해당 카테고리에 등록된 테스트 문제가 없습니다.
          </p>
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
        <div className="text-sm text-gray-500">
          {categoryTitle}
        </div>
      </div>

      {/* 진행률 */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>
            {currentIndex + 1} / {questions.length} 문제
          </span>
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
        {/* 카테고리 태그 */}
        {currentQuestion.sub_category && (
          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full mb-4">
            {currentQuestion.sub_category}
          </span>
        )}

        {/* 문제 */}
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Q{currentIndex + 1}. {currentQuestion.question}
        </h2>

        {/* 선택지 */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                answers[currentIndex] === index
                  ? 'border-primary-500 bg-primary-50 text-primary-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    answers[currentIndex] === index
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
      </div>

      {/* 문제 네비게이션 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {questions.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
              index === currentIndex
                ? 'bg-primary-600 text-white'
                : answers[index] !== null
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
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          제출하기
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
