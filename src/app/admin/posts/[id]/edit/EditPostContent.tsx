// Created: 2026-01-27 18:00:00
// Updated: 2026-01-29 - Supabase 실제 연동, 그룹 선택 UI 추가
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type ContentType = 'video' | 'document'
type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙'
type GroupName = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개'

interface Post {
  id: string
  title: string
  content_type: ContentType
  content: string
  category: Category
  sub_category: string | null
  external_link: string | null
  created_at: string
  updated_at: string
  author_id: string
}

interface SubCategory {
  id: string
  category: string
  name: string
  sort_order: number
}

interface EditPostContentProps {
  post: Post
  initialGroups: GroupName[]
}

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

export default function EditPostContent({ post, initialGroups }: EditPostContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<GroupName[]>(initialGroups)
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(post.sub_category || '')
  const [isAddingNewSubCategory, setIsAddingNewSubCategory] = useState(false)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [externalLink, setExternalLink] = useState(post.external_link || '')
  const [formData, setFormData] = useState({
    title: post.title,
    content_type: post.content_type,
    content: post.content,
    category: post.category,
  })

  // 서브카테고리 목록 조회
  useEffect(() => {
    const fetchSubCategories = async () => {
      const { data } = await supabase
        .from('sub_categories')
        .select('*')
        .order('sort_order')
        .order('name')
      setSubCategories(data || [])
    }
    fetchSubCategories()
  }, [])

  // 현재 카테고리의 서브카테고리
  const currentSubCategories = subCategories.filter(sc => sc.category === formData.category)

  // 카테고리 변경 시 서브카테고리 초기화
  useEffect(() => {
    if (formData.category !== post.category) {
      setSelectedSubCategory('')
    }
  }, [formData.category])

  // 새 서브카테고리 추가
  const handleAddNewSubCategory = async () => {
    const name = newSubCategoryName.trim()
    if (!name) return
    try {
      const { data, error } = await supabase
        .from('sub_categories')
        .insert({ category: formData.category, name, sort_order: currentSubCategories.length })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') alert('이미 존재하는 유형입니다.')
        else throw error
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

      // 게시물 업데이트
      const { error: updateError } = await supabase
        .from('educational_posts')
        .update({
          title: formData.title,
          content_type: formData.content_type,
          content: formData.content,
          category: formData.category,
          sub_category: selectedSubCategory || null,
          external_link: externalLink.trim() || null,
        })
        .eq('id', post.id)

      if (updateError) throw updateError

      // 기존 그룹 관계 삭제
      await supabase.from('post_groups').delete().eq('post_id', post.id)

      // 새 그룹 관계 저장
      const groupInserts = selectedGroups.map(groupName => ({
        post_id: post.id,
        group_name: groupName,
      }))

      const { error: groupError } = await supabase
        .from('post_groups')
        .insert(groupInserts)

      if (groupError) throw groupError

      router.push('/admin/posts')
    } catch (err: any) {
      console.error('Error updating post:', err)
      setError(err.message || '수정 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      // 그룹 관계 먼저 삭제
      await supabase.from('post_groups').delete().eq('post_id', post.id)

      // 게시물 삭제
      const { error: deleteError } = await supabase
        .from('educational_posts')
        .delete()
        .eq('id', post.id)

      if (deleteError) throw deleteError

      router.push('/admin/posts')
    } catch (err: any) {
      console.error('Error deleting post:', err)
      alert(err.message || '삭제 중 오류가 발생했습니다.')
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
                    <option key={sc.id} value={sc.name}>{sc.name}</option>
                  ))}
                  <option value="__new__">+ 새 유형 추가...</option>
                </select>
              )}
              <p className="mt-1 text-sm text-gray-500">
                카테고리 내 세부 유형을 선택하세요 (선택사항).
              </p>
            </div>

            {/* 외부 링크 (Flow 등) */}
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
                Flow 등 외부 협업 툴의 링크를 입력하면 매니저가 원본 자료를 볼 수 있습니다.
              </p>
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
            {isSubmitting ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
