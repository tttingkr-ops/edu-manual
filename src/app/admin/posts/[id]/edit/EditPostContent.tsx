// Created: 2026-01-27 18:00:00
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ContentType = 'video' | 'document'
type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙'

interface Post {
  id: string
  title: string
  content_type: ContentType
  content: string
  category: Category
  created_at: string
  updated_at: string
  author_id: string
}

interface EditPostContentProps {
  post: Post
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
]

export default function EditPostContent({ post }: EditPostContentProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: post.title,
    content_type: post.content_type,
    content: post.content,
    category: post.category,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Mock 모드에서는 단순히 성공 메시지 표시 후 목록으로 이동
    await new Promise((resolve) => setTimeout(resolve, 500))

    alert('교육 자료가 수정되었습니다. (Mock 모드)')
    router.push('/admin/posts')
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    // Mock 모드에서는 단순히 성공 메시지 표시 후 목록으로 이동
    alert('교육 자료가 삭제되었습니다. (Mock 모드)')
    router.push('/admin/posts')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-primary-600">
            대시보드
          </Link>
          <span>/</span>
          <Link href="/admin/posts" className="hover:text-primary-600">
            교육 게시물 관리
          </Link>
          <span>/</span>
          <span>수정</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">교육 자료 수정</h1>
            <p className="mt-1 text-gray-600">
              게시물 ID: {post.id.substring(0, 8)}...
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            삭제
          </button>
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>

          <div className="space-y-4">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="교육 자료의 제목을 입력하세요"
                required
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as Category })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 콘텐츠 타입 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                콘텐츠 타입 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.content_type === 'document'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="content_type"
                    value="document"
                    checked={formData.content_type === 'document'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        content_type: e.target.value as ContentType,
                      })
                    }
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.content_type === 'document'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">문서</p>
                    <p className="text-sm text-gray-500">마크다운 형식의 문서</p>
                  </div>
                </label>

                <label
                  className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.content_type === 'video'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="content_type"
                    value="video"
                    checked={formData.content_type === 'video'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        content_type: e.target.value as ContentType,
                      })
                    }
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.content_type === 'video'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">동영상</p>
                    <p className="text-sm text-gray-500">YouTube 등 외부 링크</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 콘텐츠 입력 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {formData.content_type === 'video' ? '동영상 URL' : '문서 내용'}
          </h2>

          {formData.content_type === 'video' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                YouTube URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://youtube.com/watch?v=..."
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                YouTube 동영상 URL을 입력하세요.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용 (마크다운) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                rows={15}
                placeholder="마크다운 형식으로 내용을 입력하세요..."
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                마크다운 문법을 사용할 수 있습니다. (제목: #, 목록: -, 굵게: **텍스트**)
              </p>
            </div>
          )}
        </div>

        {/* 메타 정보 */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              생성일: {new Date(post.created_at).toLocaleString('ko-KR')}
            </span>
            <span>
              수정일: {new Date(post.updated_at).toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        {/* Mock 모드 안내 */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
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
                현재 Supabase가 연결되지 않아 수정사항이 실제로 저장되지 않습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/posts"
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
