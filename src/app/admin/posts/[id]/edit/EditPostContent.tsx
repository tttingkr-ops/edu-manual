// Created: 2026-01-27 18:00:00
// Updated: 2026-01-29 - Supabase 실제 연동, 그룹 선택 UI 추가
// Updated: 2026-02-10 - 동적 그룹 조회 및 개인 지정 타겟팅 추가
// Updated: 2026-02-18 - 테스트 문제 추가/수정 기능 (QuestionBuilder)
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MarkdownEditor from '@/components/MarkdownEditor'
import QuestionBuilder, { QuestionData } from '@/components/QuestionBuilder'

type ContentType = 'video' | 'document'
type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백'

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
  post: Post & { targeting_type?: 'group' | 'individual'; approval_status?: 'approved' | 'pending' }
  initialGroups: string[]
  initialTargetUsers: string[]
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
  { value: '개인_피드백', label: '개인 피드백' },
]

export default function EditPostContent({ post, initialGroups, initialTargetUsers }: EditPostContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<{id: string; name: string}[]>([])
  const [targetingType, setTargetingType] = useState<'group' | 'individual'>(post.targeting_type || 'group')
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialGroups)
  const [managers, setManagers] = useState<{id: string; username: string; nickname: string | null}[]>([])
  const [selectedManagers, setSelectedManagers] = useState<string[]>(initialTargetUsers)
  const [managerSearch, setManagerSearch] = useState('')
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(post.sub_category || '')
  const [isAddingNewSubCategory, setIsAddingNewSubCategory] = useState(false)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [externalLink, setExternalLink] = useState(post.external_link || '')
  const [includeTest, setIncludeTest] = useState(false)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [testVisibility, setTestVisibility] = useState<'all' | 'targeted'>('all')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: post.title,
    content_type: post.content_type,
    content: post.content,
    category: post.category,
  })

  // 서브카테고리, 그룹, 매니저 목록 및 기존 테스트 문제 조회
  useEffect(() => {
    const fetchData = async () => {
      const [{ data: subCatData }, { data: groupsData }, { data: managersData }, { data: existingQs }] = await Promise.all([
        supabase.from('sub_categories').select('*').order('sort_order').order('name'),
        supabase.from('groups').select('id, name').order('name'),
        supabase.from('users').select('id, username, nickname').eq('role', 'manager').order('username'),
        supabase.from('test_questions').select('*').eq('related_post_id', post.id),
      ])
      setSubCategories(subCatData || [])
      setGroups(groupsData || [])
      setManagers(managersData || [])

      if (existingQs && existingQs.length > 0) {
        setIncludeTest(true)
        setQuestions(existingQs.map((q: any) => ({
          id: q.id,
          question: q.question,
          question_type: q.question_type || 'multiple_choice',
          question_image_url: q.question_image_url || null,
          options: q.question_type === 'subjective' ? ['', '', '', ''] : ((q.options as string[]) || ['', '', '', '']),
          correct_answer: Array.isArray(q.correct_answer)
            ? ((q.correct_answer as number[])[0] ?? null)
            : typeof q.correct_answer === 'number'
            ? q.correct_answer
            : null,
          max_score: q.max_score || 10,
          grading_criteria: q.grading_criteria || null,
          model_answer: q.model_answer || null,
        })))
      }
    }
    fetchData()
  }, [])

  // 현재 카테고리의 서브카테고리
  const currentSubCategories = subCategories.filter(sc => sc.category === formData.category)

  // 타겟팅/그룹 변경 시 카테고리 자동 유도
  const categoryDeriveRef = useRef(false)
  useEffect(() => {
    if (!categoryDeriveRef.current) {
      categoryDeriveRef.current = true
      return
    }
    if (targetingType === 'individual') {
      setFormData(prev => ({ ...prev, category: '개인_피드백' }))
    } else if (selectedGroups.length > 0) {
      const catMatch = CATEGORIES.find(c => c.label === selectedGroups[0])
      if (catMatch) setFormData(prev => ({ ...prev, category: catMatch.value }))
    }
  }, [targetingType, selectedGroups])

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
  const handleGroupToggle = (groupName: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupName])
    } else {
      setSelectedGroups(selectedGroups.filter(g => g !== groupName))
    }
  }

  // 매니저 토글 핸들러
  const handleManagerToggle = (managerId: string, checked: boolean) => {
    if (checked) {
      setSelectedManagers([...selectedManagers, managerId])
    } else {
      setSelectedManagers(selectedManagers.filter(id => id !== managerId))
    }
  }

  const filteredManagers = managers.filter(m => {
    const search = managerSearch.toLowerCase()
    return m.username.toLowerCase().includes(search) || (m.nickname && m.nickname.toLowerCase().includes(search))
  })

  const savePost = async (approveAfterSave: boolean) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // 타겟팅 검증
      if (targetingType === 'group' && selectedGroups.length === 0) {
        throw new Error('대상 그룹을 최소 1개 이상 선택해주세요.')
      }
      if (targetingType === 'individual' && selectedManagers.length === 0) {
        throw new Error('대상 매니저를 최소 1명 이상 선택해주세요.')
      }

      // 게시물 업데이트
      const updateData: any = {
        title: formData.title,
        content_type: formData.content_type,
        content: formData.content,
        category: formData.category,
        sub_category: selectedSubCategory || null,
        external_link: externalLink.trim() || null,
        targeting_type: targetingType,
        test_visibility: (targetingType === 'individual' && includeTest) ? testVisibility : 'all',
      }

      if (approveAfterSave) {
        updateData.approval_status = 'approved'
      }

      const { error: updateError } = await supabase
        .from('educational_posts')
        .update(updateData)
        .eq('id', post.id)

      if (updateError) throw updateError

      // 기존 관계 삭제
      await supabase.from('post_groups').delete().eq('post_id', post.id)
      await supabase.from('post_target_users').delete().eq('post_id', post.id)

      // 새 관계 저장 (타겟팅 타입에 따라)
      if (targetingType === 'group') {
        const groupInserts = selectedGroups.map(groupName => ({
          post_id: post.id,
          group_name: groupName,
        }))
        const { error: groupError } = await supabase.from('post_groups').insert(groupInserts)
        if (groupError) throw groupError
      } else {
        const targetInserts = selectedManagers.map(userId => ({
          post_id: post.id,
          user_id: userId,
        }))
        const { error: targetError } = await supabase.from('post_target_users').insert(targetInserts)
        if (targetError) throw targetError
      }

      // 기존 테스트 문제 삭제 후 재저장
      await supabase.from('test_questions').delete().eq('related_post_id', post.id)
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
          related_post_id: post.id,
        }))
        const { error: questionError } = await supabase.from('test_questions').insert(questionInserts)
        if (questionError) console.error('Question save error:', questionError)
      }

      router.refresh()
      router.push(approveAfterSave ? '/admin/posts/pending' : '/admin/posts')
    } catch (err: any) {
      console.error('Error updating post:', err)
      setError(err.message || '수정 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await savePost(false)
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      // 관계 먼저 삭제
      await supabase.from('post_groups').delete().eq('post_id', post.id)
      await supabase.from('post_target_users').delete().eq('post_id', post.id)

      // 게시물 삭제
      const { error: deleteError } = await supabase
        .from('educational_posts')
        .delete()
        .eq('id', post.id)

      if (deleteError) throw deleteError

      router.refresh()
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
        <Link
          href="/admin/posts"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-3 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록으로 돌아가기
        </Link>
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">교육 자료 수정</h1>
              {post.approval_status === 'pending' && (
                <span className="px-3 py-1 text-sm font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  승인 대기중
                </span>
              )}
            </div>
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

            {/* 대상 지정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                대상 지정 <span className="text-red-500">*</span>
              </label>

              {/* 타겟팅 타입 토글 */}
              <div className="flex gap-4 mb-4">
                <label
                  className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    targetingType === 'group'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="targeting_type"
                    value="group"
                    checked={targetingType === 'group'}
                    onChange={() => setTargetingType('group')}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      targetingType === 'group'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">그룹 지정</p>
                    <p className="text-sm text-gray-500">그룹 단위로 대상 지정</p>
                  </div>
                </label>

                <label
                  className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    targetingType === 'individual'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="targeting_type"
                    value="individual"
                    checked={targetingType === 'individual'}
                    onChange={() => setTargetingType('individual')}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      targetingType === 'individual'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">개인 지정</p>
                    <p className="text-sm text-gray-500">매니저 개별 지정</p>
                  </div>
                </label>
              </div>

              {/* 그룹 선택 */}
              {targetingType === 'group' && (
                <div className="space-y-2">
                  {groups.length === 0 ? (
                    <p className="text-sm text-gray-400 p-3">등록된 그룹이 없습니다.</p>
                  ) : (
                    groups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.name)}
                          onChange={(e) => handleGroupToggle(group.name, e.target.checked)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-gray-700">{group.name}</span>
                      </label>
                    ))
                  )}
                  <p className="mt-2 text-sm text-gray-500">
                    선택한 그룹 탭에 자동으로 노출됩니다. 복수 선택 시 모든 탭에 노출됩니다.
                  </p>
                </div>
              )}

              {/* 개인 선택 */}
              {targetingType === 'individual' && (
                <div>
                  <input
                    type="text"
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    placeholder="매니저 이름 또는 닉네임으로 검색..."
                    className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                    {filteredManagers.length === 0 ? (
                      <p className="text-sm text-gray-400 p-3 text-center">
                        {managerSearch ? '검색 결과가 없습니다.' : '등록된 매니저가 없습니다.'}
                      </p>
                    ) : (
                      filteredManagers.map((manager) => (
                        <label
                          key={manager.id}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedManagers.includes(manager.id)}
                            onChange={(e) => handleManagerToggle(manager.id, e.target.checked)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="text-gray-700">
                            {manager.username}
                            {manager.nickname && (
                              <span className="text-gray-400 ml-1">({manager.nickname})</span>
                            )}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedManagers.length > 0 && (
                    <p className="mt-2 text-sm text-primary-600">
                      {selectedManagers.length}명 선택됨
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    이 교육 자료를 볼 수 있는 매니저를 선택하세요.
                  </p>
                </div>
              )}
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
                placeholder="마크다운 형식으로 내용을 입력하세요... 이미지를 드래그하거나 붙여넣어 추가하세요."
                rows={15}
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

          {includeTest && targetingType === 'individual' && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                테스트 공개 범위
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="test_visibility"
                    value="all"
                    checked={testVisibility === 'all'}
                    onChange={() => setTestVisibility('all')}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">전체 공개</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="test_visibility"
                    value="targeted"
                    checked={testVisibility === 'targeted'}
                    onChange={() => setTestVisibility('targeted')}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">대상자만</span>
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {testVisibility === 'all'
                  ? '연결된 테스트 문제가 모든 매니저에게 공개됩니다.'
                  : '연결된 테스트 문제가 지정된 매니저에게만 노출됩니다.'}
              </p>
            </div>
          )}

          {includeTest && (
            <QuestionBuilder
              questions={questions}
              onChange={setQuestions}
              category={formData.category}
              content={formData.content}
              uploadedImages={uploadedImages}
            />
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
          {post.approval_status === 'pending' && (
            <button
              type="button"
              onClick={() => savePost(true)}
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '처리 중...' : '수정 후 승인'}
            </button>
          )}
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
