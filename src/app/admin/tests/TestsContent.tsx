// Created: 2026-01-27 17:40:00
'use client'

import { useState } from 'react'
import Link from 'next/link'

type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙'

interface Question {
  id: string
  category: string
  sub_category: string | null
  question: string
  options: string[]
  correct_answer: number
  related_post_id: string | null
}

interface TestsContentProps {
  questions: Question[]
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
]

export default function TestsContent({ questions: initialQuestions }: TestsContentProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [formData, setFormData] = useState({
    category: '남자_매니저_대화' as Category,
    sub_category: '',
    question: '',
    options: ['', '', '', ''],
    correct_answer: 0,
  })

  // 필터링된 문제 목록
  const filteredQuestions = questions.filter((q) => {
    const matchesCategory = filterCategory === 'all' || q.category === filterCategory
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // 카테고리별 문제 수
  const getCategoryCount = (category: string) => {
    return questions.filter((q) => q.category === category).length
  }

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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 모달 열기 (추가)
  const openAddModal = () => {
    setEditingQuestion(null)
    setFormData({
      category: '남자_매니저_대화',
      sub_category: '',
      question: '',
      options: ['', '', '', ''],
      correct_answer: 0,
    })
    setShowModal(true)
  }

  // 모달 열기 (수정)
  const openEditModal = (question: Question) => {
    setEditingQuestion(question)
    setFormData({
      category: question.category as Category,
      sub_category: question.sub_category || '',
      question: question.question,
      options: [...question.options],
      correct_answer: question.correct_answer,
    })
    setShowModal(true)
  }

  // 모달 닫기
  const closeModal = () => {
    setShowModal(false)
    setEditingQuestion(null)
  }

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingQuestion) {
      // 수정
      setQuestions(
        questions.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                ...formData,
                sub_category: formData.sub_category || null,
              }
            : q
        )
      )
    } else {
      // 추가
      const newQuestion: Question = {
        id: `new-${Date.now()}`,
        ...formData,
        sub_category: formData.sub_category || null,
        related_post_id: null,
      }
      setQuestions([...questions, newQuestion])
    }

    closeModal()
  }

  // 삭제
  const handleDelete = (questionId: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setQuestions(questions.filter((q) => q.id !== questionId))
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
          <div
            key={cat.value}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <p className="text-sm text-gray-500">{cat.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {getCategoryCount(cat.value)}
              <span className="text-sm font-normal text-gray-500 ml-1">문제</span>
            </p>
          </div>
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
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredQuestions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredQuestions.map((question, index) => (
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    세부 카테고리
                  </label>
                  <input
                    type="text"
                    value={formData.sub_category}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_category: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="예: 기본 인사"
                  />
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

              {/* 선택지 */}
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingQuestion ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mock 모드 안내 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
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
              현재 Supabase가 연결되지 않아 샘플 데이터를 표시하고 있습니다.
              변경사항은 페이지 새로고침 시 초기화됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
