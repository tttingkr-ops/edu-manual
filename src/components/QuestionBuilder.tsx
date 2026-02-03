// Created: 2026-02-01 20:35:00
'use client'

import { useState } from 'react'
import ImageUpload from './ImageUpload'

export type QuestionType = 'multiple_choice' | 'subjective'

export interface QuestionData {
  id?: string
  question_type: QuestionType
  question: string
  question_image_url: string | null
  options: string[] | null
  correct_answer: number | null
  max_score: number
  grading_criteria: string | null
  model_answer: string | null
}

interface QuestionBuilderProps {
  questions: QuestionData[]
  onChange: (questions: QuestionData[]) => void
  category: string
}

const emptyQuestion: QuestionData = {
  question_type: 'multiple_choice',
  question: '',
  question_image_url: null,
  options: ['', '', '', ''],
  correct_answer: 0,
  max_score: 10,
  grading_criteria: null,
  model_answer: null,
}

export default function QuestionBuilder({
  questions,
  onChange,
  category,
}: QuestionBuilderProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    questions.length > 0 ? 0 : null
  )

  const addQuestion = () => {
    const newQuestions = [...questions, { ...emptyQuestion }]
    onChange(newQuestions)
    setExpandedIndex(newQuestions.length - 1)
  }

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index)
    onChange(newQuestions)
    if (expandedIndex === index) {
      setExpandedIndex(newQuestions.length > 0 ? 0 : null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const updateQuestion = (index: number, updates: Partial<QuestionData>) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], ...updates }
    onChange(newQuestions)
  }

  const handleTypeChange = (index: number, type: QuestionType) => {
    if (type === 'multiple_choice') {
      updateQuestion(index, {
        question_type: type,
        options: ['', '', '', ''],
        correct_answer: 0,
        grading_criteria: null,
        model_answer: null,
      })
    } else {
      updateQuestion(index, {
        question_type: type,
        options: null,
        correct_answer: null,
        grading_criteria: '',
        model_answer: '',
      })
    }
  }

  const handleImageUpload = (index: number, url: string) => {
    updateQuestion(index, { question_image_url: url || null })
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = questions[questionIndex]
    if (!question.options) return

    const newOptions = [...question.options]
    newOptions[optionIndex] = value
    updateQuestion(questionIndex, { options: newOptions })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          테스트 문제 ({questions.length}개)
        </h3>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          문제 추가
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <p>추가된 문제가 없습니다.</p>
          <p className="text-sm mt-1">위의 &apos;문제 추가&apos; 버튼을 클릭하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* 헤더 */}
              <div
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                      q.question_type === 'multiple_choice'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {q.question_type === 'multiple_choice' ? '객관식' : '주관식'}
                    </span>
                    <p className="text-sm text-gray-700 mt-1 truncate max-w-md">
                      {q.question || '(문제를 입력하세요)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeQuestion(index)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* 내용 */}
              {expandedIndex === index && (
                <div className="p-4 space-y-4 border-t border-gray-200">
                  {/* 문제 유형 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      문제 유형
                    </label>
                    <div className="flex gap-4">
                      <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        q.question_type === 'multiple_choice'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name={`type-${index}`}
                          checked={q.question_type === 'multiple_choice'}
                          onChange={() => handleTypeChange(index, 'multiple_choice')}
                          className="sr-only"
                        />
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">객관식 (4지선다)</span>
                      </label>
                      <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        q.question_type === 'subjective'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name={`type-${index}`}
                          checked={q.question_type === 'subjective'}
                          onChange={() => handleTypeChange(index, 'subjective')}
                          className="sr-only"
                        />
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="font-medium">주관식 (AI 채점)</span>
                      </label>
                    </div>
                  </div>

                  {/* 문제 내용 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      문제 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={q.question}
                      onChange={(e) => updateQuestion(index, { question: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      placeholder="문제를 입력하세요..."
                    />
                  </div>

                  {/* 문제 이미지 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      문제 이미지 (선택)
                    </label>
                    <p className="text-sm text-gray-500 mb-2">
                      카카오톡 대화 캡처 등 상황 이미지를 첨부하면 &quot;위 상황에서 올바른 응대 방법은?&quot; 형식의 문제를 만들 수 있습니다.
                    </p>
                    {q.question_image_url ? (
                      <div className="relative inline-block">
                        <img
                          src={q.question_image_url}
                          alt="문제 이미지"
                          className="max-h-40 rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => handleImageUpload(index, '')}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <ImageUpload
                        onUpload={(url) => handleImageUpload(index, url)}
                        maxSizeMB={10}
                        bucket="education-images"
                        folder={`questions/${category}`}
                      />
                    )}
                  </div>

                  {/* 배점 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      배점
                    </label>
                    <input
                      type="number"
                      value={q.max_score}
                      onChange={(e) => updateQuestion(index, { max_score: parseInt(e.target.value) || 10 })}
                      className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min={1}
                      max={100}
                    />
                    <span className="ml-2 text-sm text-gray-500">점</span>
                  </div>

                  {/* 객관식 옵션 */}
                  {q.question_type === 'multiple_choice' && q.options && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        선택지 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {q.options.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <label className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-colors ${
                              q.correct_answer === optIndex
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name={`correct-${index}`}
                                checked={q.correct_answer === optIndex}
                                onChange={() => updateQuestion(index, { correct_answer: optIndex })}
                                className="sr-only"
                              />
                              {optIndex + 1}
                            </label>
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(index, optIndex, e.target.value)}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              placeholder={`선택지 ${optIndex + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        정답으로 설정할 번호를 클릭하세요.
                      </p>
                    </div>
                  )}

                  {/* 주관식 옵션 */}
                  {q.question_type === 'subjective' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          채점 기준 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={q.grading_criteria || ''}
                          onChange={(e) => updateQuestion(index, { grading_criteria: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          rows={3}
                          placeholder="AI가 채점할 때 참고할 기준을 입력하세요. 예: 공감 표현 포함 여부, 해결책 제시 여부, 적절한 어조 사용 등"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          모범 답안
                        </label>
                        <textarea
                          value={q.model_answer || ''}
                          onChange={(e) => updateQuestion(index, { model_answer: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          rows={4}
                          placeholder="모범 답안을 입력하세요. AI가 채점 시 참고합니다."
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
