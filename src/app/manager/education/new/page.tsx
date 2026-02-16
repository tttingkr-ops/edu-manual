// Created: 2026-02-13 12:00:00
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MarkdownEditor from '@/components/MarkdownEditor'

type ContentType = 'video' | 'document'
type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
  { value: '개인_피드백', label: '개인 피드백' },
]

interface SubCategory {
  id: string
  category: string
  name: string
  sort_order: number
}

export default function ManagerNewPostPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [isAddingNewSubCategory, setIsAddingNewSubCategory] = useState(false)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [externalLink, setExternalLink] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    content_type: 'document' as ContentType,
    content: '',
    category: '남자_매니저_대화' as Category,
  })

  // 서브카테고리 조회
  useEffect(() => {
    const fetchData = async () => {
      const { data: subCatData } = await supabase
        .from('sub_categories')
        .select('*')
        .order('sort_order')
        .order('name')
      setSubCategories(subCatData || [])
    }
    fetchData()
  }, [])

  // 카테고리 변경 시 서브카테고리 초기화
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    setSelectedSubCategory('')
    setIsAddingNewSubCategory(false)
    setNewSubCategoryName('')
  }, [formData.category])

  const currentSubCategories = subCategories.filter(sc => sc.category === formData.category)

  const handleAddNewSubCategory = async () => {
    const name = newSubCategoryName.trim()
    if (!name) return

    try {
      const { data, error } = await supabase
        .from('sub_categories')
        .insert({
          category: formData.category,
          name,
          sort_order: currentSubCategories.length,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          alert('이미 존재하는 유형입니다.')
        } else {
          throw error
        }
        return
      }

      setSubCategories([...subCategories, data])
      setSelectedSubCategory(name)
      setIsAddingNewSubCategory(false)
      setNewSubCategoryName('')
    } catch (err: any) {
      alert(err.message || '유형 추가 중 오류가 발생했습니다.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('로그인이 필요합니다.')
      }

      // 게시물 저장 (매니저 작성 → pending, 관리자 승인 후 게시)
      const { error: insertError } = await supabase
        .from('educational_posts')
        .insert({
          title: formData.title,
          content_type: formData.content_type,
          content: formData.content,
          category: formData.category,
          sub_category: selectedSubCategory || null,
          external_link: externalLink.trim() || null,
          author_id: user.id,
          targeting_type: 'group',
          approval_status: 'pending',
        })

      if (insertError) throw insertError

      alert('게시글이 관리자 승인 대기 상태로 등록되었습니다.')
      router.push('/manager/education')
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
          <Link href="/manager/education" className="hover:text-primary-600">
            교육 자료
          </Link>
          <span>/</span>
          <span>새 교육 자료</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">새 교육 자료 등록</h1>
        <p className="mt-1 text-gray-600">
          교육 자료를 등록합니다. 관리자 승인 후 게시됩니다.
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

            {/* 서브카테고리 (유형) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                유형 (서브카테고리)
              </label>
              {isAddingNewSubCategory ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubCategoryName}
                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddNewSubCategory() }
                      if (e.key === 'Escape') { setIsAddingNewSubCategory(false); setNewSubCategoryName('') }
                    }}
                    placeholder="새 유형 이름"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddNewSubCategory}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAddingNewSubCategory(false); setNewSubCategoryName('') }}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <select
                  value={selectedSubCategory}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsAddingNewSubCategory(true)
                      setSelectedSubCategory('')
                    } else {
                      setSelectedSubCategory(e.target.value)
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">선택 안함</option>
                  {currentSubCategories.map((sc) => (
                    <option key={sc.id} value={sc.name}>
                      {sc.name}
                    </option>
                  ))}
                  <option value="__new__">+ 새 유형 추가...</option>
                </select>
              )}
              <p className="mt-1 text-sm text-gray-500">
                카테고리 내 세부 유형을 선택하세요 (선택사항).
              </p>
            </div>

            {/* 외부 링크 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                외부 링크 (Flow 등)
              </label>
              <input
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://flow.team/l/..."
              />
              <p className="mt-1 text-sm text-gray-500">
                Flow 등 외부 협업 툴의 링크를 입력하면 원본 자료를 볼 수 있습니다.
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
                      setFormData({ ...formData, content_type: e.target.value as ContentType })
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
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                      setFormData({ ...formData, content_type: e.target.value as ContentType })
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
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              />
            </div>
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
            href="/manager/education"
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
