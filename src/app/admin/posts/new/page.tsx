// Created: 2026-01-27 17:20:00
// Updated: 2026-02-01 - 테스트 문제 추가 기능 (객관식/주관식 지원)
// Updated: 2026-02-03 - 마크다운 에디터 드래그앤드랍 이미지 업로드 지원
// Updated: 2026-02-10 - 동적 그룹 조회 및 개인 지정 타겟팅 추가
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import QuestionBuilder, { QuestionData } from '@/components/QuestionBuilder'
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

export default function NewPostPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlCategory = searchParams.get('category') as Category | null
  const urlSubCategory = searchParams.get('subcategory')
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<{id: string; name: string}[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [targetingType, setTargetingType] = useState<'group' | 'individual'>('group')
  const [managers, setManagers] = useState<{id: string; username: string; nickname: string | null}[]>([])
  const [selectedManagers, setSelectedManagers] = useState<string[]>([])
  const [managerSearch, setManagerSearch] = useState('')
  const [includeTest, setIncludeTest] = useState(false)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(urlSubCategory || '')
  const [isAddingNewSubCategory, setIsAddingNewSubCategory] = useState(false)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [externalLink, setExternalLink] = useState('')
  const validCategories: Category[] = ['남자_매니저_대화', '여자_매니저_대화', '여자_매니저_소개', '추가_서비스_규칙', '개인_피드백']
  const initialCategory = (urlCategory && validCategories.includes(urlCategory)) ? urlCategory : '남자_매니저_대화'
  const [formData, setFormData] = useState({
    title: '',
    content_type: 'document' as ContentType,
    content: '',
    category: initialCategory,
  })

  // 서브카테고리, 그룹, 매니저 목록 조회
  useEffect(() => {
    const fetchData = async () => {
      const [{ data: subCatData }, { data: groupsData }, { data: managersData }] = await Promise.all([
        supabase.from('sub_categories').select('*').order('sort_order').order('name'),
        supabase.from('groups').select('id, name').order('name'),
        supabase.from('users').select('id, username, nickname').eq('role', 'manager').order('username'),
      ])
      setSubCategories(subCatData || [])
      setGroups(groupsData || [])
      setManagers(managersData || [])
    }
    fetchData()
  }, [])

  // 카테고리 변경 시 서브카테고리 초기화 (URL 파라미터로 설정된 초기값은 유지)
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

  // 현재 카테고리의 서브카테고리
  const currentSubCategories = subCategories.filter(sc => sc.category === formData.category)

  // 새 서브카테고리 추가 핸들러
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

  // 매니저 검색 필터
  const filteredManagers = managers.filter(m => {
    const search = managerSearch.toLowerCase()
    return m.username.toLowerCase().includes(search) || (m.nickname && m.nickname.toLowerCase().includes(search))
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // 대상 선택 검증
      if (targetingType === 'group' && selectedGroups.length === 0) {
        throw new Error('대상 그룹을 최소 1개 이상 선택해주세요.')
      }
      if (targetingType === 'individual' && selectedManagers.length === 0) {
        throw new Error('대상 매니저를 최소 1명 이상 선택해주세요.')
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
          sub_category: selectedSubCategory || null,
          external_link: externalLink.trim() || null,
          author_id: user.id,
          targeting_type: targetingType,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 대상 저장 (그룹 또는 개인)
      if (targetingType === 'group') {
        const groupInserts = selectedGroups.map(groupName => ({
          post_id: data.id,
          group_name: groupName,
        }))

        const { error: groupError } = await supabase
          .from('post_groups')
          .insert(groupInserts)

        if (groupError) {
          await supabase.from('educational_posts').delete().eq('id', data.id)
          throw groupError
        }
      } else {
        const targetInserts = selectedManagers.map(userId => ({
          post_id: data.id,
          user_id: userId,
        }))

        const { error: targetError } = await supabase
          .from('post_target_users')
          .insert(targetInserts)

        if (targetError) {
          await supabase.from('educational_posts').delete().eq('id', data.id)
          throw targetError
        }
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
                <div className="flex items-center gap-2">
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">선택 안함</option>
                    {currentSubCategories.map((sc) => (
                      <option key={sc.id} value={sc.name}>
                        {sc.name}
                      </option>
                    ))}
                    <option value="__new__">+ 새 유형 추가...</option>
                  </select>
                </div>
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
                    이 교육 자료를 볼 수 있는 그룹을 선택하세요.
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
            <QuestionBuilder
              questions={questions}
              onChange={setQuestions}
              category={formData.category}
              content={formData.content}
              uploadedImages={uploadedImages}
            />
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
