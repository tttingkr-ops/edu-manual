// Created: 2026-01-27 17:40:00
// Updated: 2026-01-29 - Supabase 실제 연동, 게시글 연결 기능 추가
// Updated: 2026-02-02 - 문제 이미지 업로드 기능 추가
// Updated: 2026-02-03 - 성능 최적화 (페이지네이션, useMemo, useCallback)
// Updated: 2026-02-07 - 서브카테고리 DB 기반 드롭다운으로 변경
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ImageUpload from '@/components/ImageUpload'

// Parse question_image_url - handles both single URL (legacy) and JSON array
function parseQuestionImages(val: string | null): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : [val]
  } catch {
    return val ? [val] : []
  }
}

function serializeQuestionImages(urls: string[]): string | null {
  if (urls.length === 0) return null
  return JSON.stringify(urls)
}

const ITEMS_PER_PAGE = 20

type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백'

interface Question {
  id: string
  category: string
  sub_category: string | null
  question: string
  question_type: 'multiple_choice' | 'subjective'
  question_image_url: string | null
  options: string[] | null
  correct_answer: number | null
  max_score: number
  grading_criteria: string | null
  model_answer: string | null
  related_post_id: string | null
}

interface Post {
  id: string
  title: string
  category: string
  content: string
}

interface SubCategory {
  id: string
  category: string
  name: string
  sort_order: number
}

interface TestsContentProps {
  questions: Question[]
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
  { value: '개인_피드백', label: '개인 피드백' },
]

export default function TestsContent({ questions: initialQuestions }: TestsContentProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [posts, setPosts] = useState<Post[]>([])
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    category: '남자_매니저_대화' as Category,
    sub_category: '',
    question: '',
    question_type: 'multiple_choice' as 'multiple_choice' | 'subjective',
    question_image_url: '' as string,
    options: ['', '', '', ''],
    correct_answer: 0,
    max_score: 10,
    grading_criteria: '',
    model_answer: '',
    related_post_id: null as string | null,
  })

  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [filterSubCategory, setFilterSubCategory] = useState<string | 'all'>('all')

  const supabase = createClient()

  // 게시글 + 서브카테고리 목록 조회
  useEffect(() => {
    const fetchData = async () => {
      const [{ data: postsData }, { data: subCatsData }] = await Promise.all([
        supabase
          .from('educational_posts')
          .select('id, title, category, content')
          .order('title'),
        supabase
          .from('sub_categories')
          .select('*')
          .order('sort_order')
          .order('name'),
      ])
      setPosts(postsData || [])
      setSubCategories(subCatsData || [])
    }
    fetchData()
  }, [])

  // 현재 폼 카테고리의 서브카테고리
  const formSubCategories = subCategories.filter(sc => sc.category === formData.category)

  // 필터용: 현재 필터 카테고리의 서브카테고리
  const filterSubCategories = filterCategory !== 'all'
    ? subCategories.filter(sc => sc.category === filterCategory)
    : []

  // 선택된 교육 자료에서 이미지 URL 추출
  const getPostImages = (postId: string | null): string[] => {
    if (!postId) return []
    const post = posts.find(p => p.id === postId)
    if (!post?.content) return []
    const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g
    const images: string[] = []
    let match
    while ((match = imgRegex.exec(post.content)) !== null) {
      images.push(match[1])
    }
    return images
  }

  // 필터링된 문제 목록 (useMemo로 최적화)
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesCategory = filterCategory === 'all' || q.category === filterCategory
      const matchesSubCategory = filterSubCategory === 'all' || q.sub_category === filterSubCategory
      const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSubCategory && matchesSearch
    })
  }, [questions, filterCategory, filterSubCategory, searchTerm])

  // 페이지네이션 적용된 문제 목록
  const paginatedQuestions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredQuestions.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredQuestions, currentPage])

  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE)

  // 필터 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(1)
  }, [filterCategory, filterSubCategory, searchTerm])

  // 카테고리 필터 변경 시 서브카테고리 필터 초기화
  useEffect(() => {
    setFilterSubCategory('all')
  }, [filterCategory])

  // 카테고리별 문제 수 (useMemo로 최적화)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    CATEGORIES.forEach(cat => {
      counts[cat.value] = questions.filter(q => q.category === cat.value).length
    })
    return counts
  }, [questions])

  const getCategoryCount = useCallback((category: string) => {
    return categoryCounts[category] || 0
  }, [categoryCounts])

  // 카테고리 라벨
  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category
  }

  // 카테고리 배지 색상
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case '남자_매니저_대화':
        return 'bg-blue-100 text-blue-800'
      case '여자_매니저_대화':
        return 'bg-pink-100 text-pink-800'
      case '여자_매니저_소개':
        return 'bg-purple-100 text-purple-800'
      case '추가_서비스_규칙':
        return 'bg-orange-100 text-orange-800'
      case '개인_피드백':
        return 'bg-teal-100 text-teal-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 모달 열기 (추가)
  const openAddModal = () => {
    setEditingQuestion(null)
    setError(null)
    setFormData({
      category: '남자_매니저_대화',
      sub_category: '',
      question: '',
      question_type: 'multiple_choice',
      question_image_url: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      max_score: 10,
      grading_criteria: '',
      model_answer: '',
      related_post_id: null,
    })
    setShowModal(true)
  }

  // 모달 열기 (수정)
  const openEditModal = (question: Question) => {
    setEditingQuestion(question)
    setError(null)
    setFormData({
      category: question.category as Category,
      sub_category: question.sub_category || '',
      question: question.question,
      question_type: question.question_type,
      question_image_url: question.question_image_url || '',
      options: question.options ? [...question.options] : ['', '', '', ''],
      correct_answer: question.correct_answer ?? 0,
      max_score: question.max_score,
      grading_criteria: question.grading_criteria || '',
      model_answer: question.model_answer || '',
      related_post_id: question.related_post_id,
    })
    setShowModal(true)
  }

  // 카테고리 변경 시 관련 게시글 초기화
  const handleCategoryChange = (newCategory: Category) => {
    const currentPost = posts.find(p => p.id === formData.related_post_id)
    setFormData({
      ...formData,
      category: newCategory,
      related_post_id: currentPost?.category === newCategory ? formData.related_post_id : null
    })
  }

  // 모달 닫기
  const closeModal = () => {
    setShowModal(false)
    setEditingQuestion(null)
    setError(null)
  }

  // 폼 제출 - Supabase에 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const questionData = {
        category: formData.category,
        sub_category: formData.sub_category || null,
        question: formData.question,
        question_type: formData.question_type,
        question_image_url: formData.question_image_url || null,
        options: formData.question_type === 'multiple_choice' ? formData.options : null,
        correct_answer: formData.question_type === 'multiple_choice' ? formData.correct_answer : null,
        max_score: formData.max_score,
        grading_criteria: formData.question_type === 'subjective' ? formData.grading_criteria || null : null,
        model_answer: formData.question_type === 'subjective' ? formData.model_answer || null : null,
        related_post_id: formData.related_post_id,
      }

      if (editingQuestion) {
        // 수정
        const { data, error: updateError } = await supabase
          .from('test_questions')
          .update(questionData)
          .eq('id', editingQuestion.id)
          .select()
          .single()

        if (updateError) throw updateError

        setQuestions(
          questions.map((q) =>
            q.id === editingQuestion.id ? { ...data, options: data.options as string[] | null } : q
          )
        )
      } else {
        // 추가
        const { data, error: insertError } = await supabase
          .from('test_questions')
          .insert(questionData)
          .select()
          .single()

        if (insertError) throw insertError

        setQuestions([...questions, { ...data, options: data.options as string[] | null }])
      }

      closeModal()
    } catch (err: any) {
      console.error('Error saving question:', err)
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 삭제 - Supabase에서 삭제
  const handleDelete = async (questionId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    setIsLoading(true)
    try {
      const { error: deleteError } = await supabase
        .from('test_questions')
        .delete()
        .eq('id', questionId)

      if (deleteError) throw deleteError

      setQuestions(questions.filter((q) => q.id !== questionId))
    } catch (err: any) {
      console.error('Error deleting question:', err)
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 옵션 변경
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-primary-600">
              대시보드
            </Link>
            <span>/</span>
            <span>테스트 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">테스트 문제 관리</h1>
          <p className="mt-1 text-gray-600">
            총 {questions.length}개의 문제가 등록되어 있습니다.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 문제 추가
        </button>
      </div>

      {/* 카테고리별 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
            className={`bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md cursor-pointer ${
              filterCategory === cat.value
                ? 'border-primary-500 ring-2 ring-primary-100'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className={`text-sm ${filterCategory === cat.value ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>{cat.label}</p>
            <p className={`text-2xl font-bold ${filterCategory === cat.value ? 'text-primary-700' : 'text-gray-900'}`}>
              {getCategoryCount(cat.value)}
              <span className="text-sm font-normal text-gray-500 ml-1">문제</span>
            </p>
          </button>
        ))}
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="문제 내용으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* 카테고리 필터 */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">모든 카테고리</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* 서브카테고리 필터 */}
          {filterCategory !== 'all' && filterSubCategories.length > 0 && (
            <div>
              <select
                value={filterSubCategory}
                onChange={(e) => setFilterSubCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">모든 유형</option>
                {filterSubCategories.map((sc) => (
                  <option key={sc.id} value={sc.name}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredQuestions.length > 0 ? (
          <>
            {/* 결과 요약 */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
              총 {filteredQuestions.length}개 문제 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredQuestions.length)}개 표시
            </div>

            <div className="divide-y divide-gray-200">
              {paginatedQuestions.map((question, index) => (
                <div key={question.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryBadgeClass(
                            question.category
                          )}`}
                        >
                          {getCategoryLabel(question.category)}
                        </span>
                        {question.sub_category && (
                          <span className="text-xs text-gray-500">
                            {question.sub_category}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 mb-2">
                        {question.question}
                      </p>
                      {parseQuestionImages(question.question_image_url).length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {parseQuestionImages(question.question_image_url).map((imgUrl, i) => (
                            <img
                              key={i}
                              src={imgUrl}
                              alt={`문제 이미지 ${i + 1}`}
                              loading="lazy"
                              className="max-h-24 rounded border"
                            />
                          ))}
                        </div>
                      )}
                    {question.question_type === 'subjective' ? (
                      <div className="p-3 bg-purple-50 rounded border border-purple-200">
                        <span className="text-sm text-purple-700 font-medium">주관식 문제</span>
                        <p className="text-sm text-gray-600 mt-1">배점: {question.max_score}점</p>
                        {question.grading_criteria && (
                          <p className="text-sm text-gray-500 mt-1">채점기준: {question.grading_criteria}</p>
                        )}
                      </div>
                    ) : question.options && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className={`p-2 rounded ${
                              optIndex === question.correct_answer
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {optIndex + 1}. {option}
                            {optIndex === question.correct_answer && (
                              <span className="ml-2 text-green-600">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(question)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="수정"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'border hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center text-gray-500">
            {searchTerm || filterCategory !== 'all'
              ? '검색 결과가 없습니다.'
              : '등록된 문제가 없습니다.'}
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingQuestion ? '문제 수정' : '새 문제 추가'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 카테고리 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value as Category)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    유형 (서브카테고리)
                  </label>
                  <select
                    value={formData.sub_category}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_category: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">선택 안함</option>
                    {formSubCategories.map((sc) => (
                      <option key={sc.id} value={sc.name}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 관련 교육 자료 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  관련 교육 자료
                </label>
                <select
                  value={formData.related_post_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      related_post_id: e.target.value || null
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">선택 안함</option>
                  {posts
                    .filter(p => p.category === formData.category)
                    .map(post => (
                      <option key={post.id} value={post.id}>{post.title}</option>
                    ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  같은 카테고리의 교육 자료만 표시됩니다. 오답 시 학습 링크로 제공됩니다.
                </p>
              </div>

              {/* 문제 유형 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  문제 유형 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.question_type === 'multiple_choice'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="question_type"
                      checked={formData.question_type === 'multiple_choice'}
                      onChange={() => setFormData({ ...formData, question_type: 'multiple_choice' })}
                      className="sr-only"
                    />
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">객관식 (4지선다)</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.question_type === 'subjective'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="question_type"
                      checked={formData.question_type === 'subjective'}
                      onChange={() => setFormData({ ...formData, question_type: 'subjective' })}
                      className="sr-only"
                    />
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="font-medium">주관식 (AI 채점)</span>
                  </label>
                </div>
              </div>

              {/* 문제 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  문제 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  placeholder="문제 내용을 입력하세요"
                  required
                />
              </div>

              {/* 문제 이미지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  문제 이미지 (선택, 복수 선택 가능)
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  카카오톡 대화 캡처 등 상황 이미지를 첨부하면 &quot;위 상황에서 올바른 응대 방법은?&quot; 형식의 문제를 만들 수 있습니다.
                </p>
                {/* 선택된 이미지 미리보기 */}
                {parseQuestionImages(formData.question_image_url).length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      선택된 이미지 ({parseQuestionImages(formData.question_image_url).length}개)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parseQuestionImages(formData.question_image_url).map((imgUrl, i) => (
                        <div key={i} className="relative inline-block">
                          <img
                            src={imgUrl}
                            alt={`문제 이미지 ${i + 1}`}
                            className="h-24 w-auto rounded-lg border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const urls = parseQuestionImages(formData.question_image_url).filter(u => u !== imgUrl)
                              setFormData({ ...formData, question_image_url: serializeQuestionImages(urls) || '' })
                            }}
                            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {/* 교육 자료 이미지 선택 (토글) */}
                  {formData.related_post_id && getPostImages(formData.related_post_id).length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">
                        교육 자료 이미지에서 선택 (클릭하여 추가/제거)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getPostImages(formData.related_post_id).map((imgUrl, i) => {
                          const isSelected = parseQuestionImages(formData.question_image_url).includes(imgUrl)
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const current = parseQuestionImages(formData.question_image_url)
                                const newUrls = isSelected
                                  ? current.filter(u => u !== imgUrl)
                                  : [...current, imgUrl]
                                setFormData({ ...formData, question_image_url: serializeQuestionImages(newUrls) || '' })
                              }}
                              className={`relative group border-2 rounded-lg overflow-hidden transition-all ${
                                isSelected
                                  ? 'border-blue-500 ring-2 ring-blue-300'
                                  : 'border-transparent hover:border-blue-300'
                              }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`교육 자료 이미지 ${i + 1}`}
                                className="h-20 w-auto object-cover rounded"
                              />
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              {!isSelected && (
                                <div className="absolute inset-0 bg-blue-600 bg-opacity-0 group-hover:bg-opacity-10 transition-all" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* 직접 업로드 */}
                  <ImageUpload
                    onUpload={(url) => {
                      const current = parseQuestionImages(formData.question_image_url)
                      if (!current.includes(url)) {
                        setFormData({ ...formData, question_image_url: serializeQuestionImages([...current, url]) || '' })
                      }
                    }}
                    maxSizeMB={10}
                    bucket="education-images"
                    folder={`questions/${formData.category}`}
                  />
                </div>
              </div>

              {/* 배점 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  배점
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 10 })}
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    min={1}
                    max={100}
                  />
                  <span className="text-sm text-gray-500">점</span>
                </div>
              </div>

              {/* 객관식 선택지 */}
              {formData.question_type === 'multiple_choice' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    선택지 <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct_answer"
                          checked={formData.correct_answer === index}
                          onChange={() => setFormData({ ...formData, correct_answer: index })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="w-6 text-sm text-gray-500">{index + 1}.</span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder={`선택지 ${index + 1}`}
                          required
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    라디오 버튼을 클릭하여 정답을 선택하세요.
                  </p>
                </div>
              )}

              {/* 주관식 옵션 */}
              {formData.question_type === 'subjective' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      채점 기준 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.grading_criteria}
                      onChange={(e) => setFormData({ ...formData, grading_criteria: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      placeholder="AI가 채점할 때 참고할 기준을 입력하세요. 예: 공감 표현 포함 여부, 해결책 제시 여부, 적절한 어조 사용 등"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      모범 답안
                    </label>
                    <textarea
                      value={formData.model_answer}
                      onChange={(e) => setFormData({ ...formData, model_answer: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={4}
                      placeholder="모범 답안을 입력하세요. AI가 채점 시 참고합니다."
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : editingQuestion ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
