// Created: 2026-02-18 00:00:00
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MarkdownEditor from '@/components/MarkdownEditor'

type Priority = 'urgent' | 'high' | 'normal' | 'low' | ''

interface MeetingPost {
  id: string
  title: string
  content: string | null
  post_type: 'free' | 'poll'
  priority: string | null
  deadline: string | null
  sub_category: string | null
}

interface SubCategory {
  id: string
  name: string
}

interface EditMeetingContentProps {
  post: MeetingPost
  subCategories: SubCategory[]
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: '', label: '없음', color: 'text-gray-500' },
  { value: 'urgent', label: '긴급', color: 'text-red-600' },
  { value: 'high', label: '높음', color: 'text-orange-600' },
  { value: 'normal', label: '보통', color: 'text-blue-600' },
  { value: 'low', label: '낮음', color: 'text-gray-500' },
]

export default function EditMeetingContent({ post, subCategories }: EditMeetingContentProps) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content || '')
  const [priority, setPriority] = useState<Priority>((post.priority as Priority) || '')
  const [deadline, setDeadline] = useState(post.deadline ? post.deadline.split('T')[0] : '')
  const [subCategory, setSubCategory] = useState(post.sub_category || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('meeting_posts')
        .update({
          title: title.trim(),
          content: content.trim() || null,
          priority: priority || null,
          deadline: deadline || null,
          sub_category: subCategory || null,
        })
        .eq('id', post.id)

      if (updateError) throw updateError

      router.push(`/meetings/${post.id}`)
    } catch (err: any) {
      console.error('Error updating meeting post:', err)
      setError(err.message || '수정 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 뒤로가기 + 브레드크럼 */}
      <Link
        href={`/meetings/${post.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-3 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        안건으로 돌아가기
      </Link>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/meetings" className="hover:text-primary-600">회의 안건방</Link>
        <span>/</span>
        <span className="truncate max-w-xs">{post.title}</span>
        <span>/</span>
        <span>수정</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">안건 수정</h1>
        {post.post_type === 'poll' && (
          <p className="mt-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block mt-2">
            투표 안건의 투표 항목은 수정할 수 없습니다. 제목·내용·우선순위·마감일만 변경 가능합니다.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="안건 제목을 입력하세요"
              required
            />
          </div>

          {/* 유형 */}
          {subCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSubCategory('')}
                  className={`px-3 py-1.5 text-sm rounded-full border-2 transition-all ${
                    subCategory === ''
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  없음
                </button>
                {subCategories.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSubCategory(sc.name)}
                    className={`px-3 py-1.5 text-sm rounded-full border-2 transition-all ${
                      subCategory === sc.name
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {sc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    priority === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 마감일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">마감일</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {deadline && (
              <button
                type="button"
                onClick={() => setDeadline('')}
                className="ml-2 text-sm text-gray-400 hover:text-gray-600"
              >
                제거
              </button>
            )}
          </div>
        </div>

        {/* 내용 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="안건 내용을 입력하세요... 이미지를 드래그하거나 붙여넣어 추가하세요."
            rows={12}
          />
        </div>

        {/* 에러 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/meetings/${post.id}`}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
