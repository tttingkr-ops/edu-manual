// Created: 2026-01-27 17:20:00
// Updated: 2026-02-01 - 테스트 문제 추가 기능 (객관식/주관식 지원)
// Updated: 2026-02-03 - 마크다운 에디터 드래그앤드랍 이미지 업로드 지원
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import QuestionBuilder, { QuestionData } from '@/components/QuestionBuilder'
import MarkdownEditor from '@/components/MarkdownEditor'

type ContentType = 'video' | 'document'
type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙'
type GroupName = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
]

const GROUPS: { value: GroupName; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
]

export default function NewPostPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<GroupName[]>([])
  const [includeTest, setIncludeTest] = useState(false)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: '',
    content_type: 'document' as ContentType,
    content: '',
    category: '남자_매니저_대화' as Category,
  })

  // 그룹 토글 핸들러
  const handleGroupToggle = (group: GroupName, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, group])
    } else {
      setSelectedGroups(selectedGroups.filter(g => g !== group))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // 그룹 선택 검증
      if (selectedGroups.length === 0) {
        throw new Error('대상 그룹을 최소 1개 이상 선택해주세요.')
      }

      // 테스트 문제 검증
      if (includeTest && questions.length > 0) {
        for (const q of questions) {
          if (!q.question.trim()) {
            throw new Error('모든 문제의 내용을 입력해주세요.')
          }
          if (q.question_type === 'multiple_choice') {
            if (!q.options || q.options.some(opt => !opt.trim())) {
              throw new Error('객관식 문제의 모든 선택지를 입력해주세요.')
            }
          } else if (q.question_type === 'subjective') {
            if (!q.grading_criteria?.trim()) {
              throw new Error('주관식 문제의 채점 기준을 입력해주세요.')
            }
          }
        }
      }

      // 현재 로그인한 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('로그인이 필요합니다.')
      }

      // 게시물 저장
      const { data, error: insertError } = await supabase
        .from('educational_posts')
        .insert({
          title: formData.title,
          content_type: formData.content_type,
          content: formData.content,
          category: formData.category,
          author_id: user.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 그룹 관계 저장
      const groupInserts = selectedGroups.map(groupName => ({
        post_id: data.id,
        group_name: groupName,
      }))

      const { error: groupError } = await supabase
        .from('post_groups')
        .insert(groupInserts)

      if (groupError) {
        // 롤백: 게시물 삭제
        await supabase.from('educational_posts').delete().eq('id', data.id)
        throw groupError
      }

      // 테스트 문제 저장
      if (includeTest && questions.length > 0) {
        const questionInserts = questions.map(q => ({
          category: formData.category,
          sub_category: null,
          question: q.question,
          question_type: q.question_type,
          question_image_url: q.question_image_url,
          options: q.question_type === 'multiple_choice' ? q.options : null,
          correct_answer: q.question_type === 'multiple_choice' ? q.correct_answer : null,
          max_score: q.max_score,
          grading_criteria: q.grading_criteria,
          model_answer: q.model_answer,
          related_post_id: data.id,
        }))

        const { error: questionError } = await supabase
          .from('test_questions')
          .insert(questionInserts)

        if (questionError) {
          console.error('Question insert error:', questionError)
          // 문제 저장 실패해도 게시물은 유지 (경고만 표시)
        }
      }

      router.push('/admin/posts')
    } catch (err: any) {
      console.error('Error creating post:', err)
      setError(err.message || '등록 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
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
          <span>새 교육 자료</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">새 교육 자료 등록</h1>
        <p className="mt-1 text-gray-600">
          매니저들에게 제공할 교육 자료를 등록합니다.
        </p>
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

            {/* 대상 그룹 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                대상 그룹 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {GROUPS.map((group) => (
                  <label
                    key={group.value}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.value)}
                      onChange={(e) => handleGroupToggle(group.value, e.target.checked)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{group.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                이 교육 자료를 볼 수 있는 그룹을 선택하세요.
              </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                내용 (마크다운) <span className="text-red-500">*</span>
              </label>
              <MarkdownEditor
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                placeholder={`# 제목

## 소제목

내용을 입력하세요...

- 목록 항목 1
- 목록 항목 2

**굵은 글씨**, *기울임 글씨*

이미지를 드래그하거나 붙여넣어 추가하세요.`}
                rows={15}
                onImageUpload={(url) => setUploadedImages(prev => [...prev, url])}
              />
            </div>
          )}
        </div>

        {/* 테스트 문제 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">테스트 문제</h2>
              <p className="text-sm text-gray-500">
                이 교육 자료와 연결된 테스트 문제를 추가합니다.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTest}
                onChange={(e) => setIncludeTest(e.target.checked)}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">테스트 추가</span>
            </label>
          </div>

          {includeTest && (
            <>
              {/* 업로드된 이미지에서 선택 */}
              {uploadedImages.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">
                    교육 자료에 업로드된 이미지를 문제에 사용할 수 있습니다
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {uploadedImages.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`업로드 이미지 ${index + 1}`}
                          className="w-20 h-20 object-cover rounded border border-blue-300"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(url)
                              alert('이미지 URL이 복사되었습니다. 문제 이미지에 붙여넣기 하세요.')
                            }}
                            className="text-xs text-white bg-blue-600 px-2 py-1 rounded"
                          >
                            URL 복사
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <QuestionBuilder
                questions={questions}
                onChange={setQuestions}
                category={formData.category}
              />
            </>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

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
            {isSubmitting ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
