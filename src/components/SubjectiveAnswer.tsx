// Created: 2026-02-01 20:35:00
'use client'

import { useState } from 'react'
import ImageUpload from './ImageUpload'

interface SubjectiveAnswerProps {
  questionId: string
  question: string
  maxScore: number
  onSubmit: (answer: { text: string; imageUrl: string | null; imagePath: string | null }) => void
  disabled?: boolean
  initialAnswer?: {
    text: string
    imageUrl: string | null
  }
}

export default function SubjectiveAnswer({
  questionId,
  question,
  maxScore,
  onSubmit,
  disabled = false,
  initialAnswer,
}: SubjectiveAnswerProps) {
  const [answerText, setAnswerText] = useState(initialAnswer?.text || '')
  const [imageUrl, setImageUrl] = useState<string | null>(initialAnswer?.imageUrl || null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleImageUpload = (url: string, path: string) => {
    setImageUrl(url || null)
    setImagePath(path || null)
  }

  const handleSubmit = async () => {
    if (!answerText.trim() && !imageUrl) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        text: answerText,
        imageUrl,
        imagePath,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* 문제 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
            주관식
          </span>
          <span className="text-sm text-gray-500">{maxScore}점</span>
        </div>
        <p className="text-gray-900 whitespace-pre-wrap">{question}</p>
      </div>

      {/* 답변 입력 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            답변 작성
          </label>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            rows={6}
            placeholder="답변을 입력하세요..."
            disabled={disabled || isSubmitting}
          />
        </div>

        {/* 이미지 업로드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이미지 첨부 (선택)
          </label>
          <p className="text-sm text-gray-500 mb-2">
            카카오톡 대화 캡처 등 참고 이미지를 첨부할 수 있습니다.
          </p>
          <ImageUpload
            onUpload={handleImageUpload}
            maxSizeMB={5}
            folder={`answers/${questionId}`}
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || isSubmitting || (!answerText.trim() && !imageUrl)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                제출 중...
              </span>
            ) : (
              '답변 제출'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
