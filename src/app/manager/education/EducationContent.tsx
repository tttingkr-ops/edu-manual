// Created: 2026-01-27 16:30:00
// Updated: 2026-02-07 - 서브카테고리 필터 칩 추가
'use client'

import { useState } from 'react'
import Link from 'next/link'
import PostCard from '@/components/PostCard'

interface Post {
  id: string
  title: string
  content_type: 'video' | 'document'
  content: string
  category: string
  sub_category: string | null
  created_at: string
  updated_at: string
  author_id: string
  isRead: boolean
}

interface SubCategory {
  id: string
  category: string
  name: string
  sort_order: number
}

interface EducationContentProps {
  posts: Post[]
  subCategories: SubCategory[]
  allowedCategories: string[] | null // null = 모든 카테고리 접근 가능
}

const ALL_CATEGORIES = [
  { id: '남자_매니저_대화', label: '남자 매니저 대화' },
  { id: '여자_매니저_대화', label: '여자 매니저 대화' },
  { id: '여자_매니저_소개', label: '여자 매니저 소개' },
  { id: '추가_서비스_규칙', label: '추가 서비스 규칙' },
  { id: '개인_피드백', label: '개인 피드백' },
]

export default function EducationContent({ posts, subCategories, allowedCategories }: EducationContentProps) {
  // 허용된 카테고리만 필터링
  const CATEGORIES = allowedCategories
    ? ALL_CATEGORIES.filter(c => allowedCategories.includes(c.id))
    : ALL_CATEGORIES

  const [activeTab, setActiveTab] = useState(CATEGORIES[0]?.id || '')
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null)

  // 현재 탭의 서브카테고리
  const currentSubCategories = subCategories.filter(sc => sc.category === activeTab)

  // 탭 변경 시 서브카테고리 초기화
  const handleTabChange = (categoryId: string) => {
    setActiveTab(categoryId)
    setActiveSubCategory(null)
  }

  // 현재 탭의 게시물 필터링
  const filteredPosts = posts.filter((post) => {
    const matchesCategory = post.category === activeTab
    const matchesSubCategory = activeSubCategory === null || post.sub_category === activeSubCategory
    return matchesCategory && matchesSubCategory
  })

  // 미확인 게시물 수 계산
  const getUnreadCount = (categoryId: string) => {
    return posts.filter((post) => post.category === categoryId && !post.isRead)
      .length
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">교육 자료</h1>
        <p className="mt-2 text-gray-600">
          각 카테고리별 교육 자료를 학습하세요. 미확인 자료는 강조 표시됩니다.
        </p>
      </div>

      {/* 테스트 바로가기 */}
      <div className="mb-6">
        <Link
          href="/manager/test"
          className="block bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl p-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white text-xl">
                📝
              </div>
              <div>
                <p className="font-semibold text-gray-900">테스트 응시하기</p>
                <p className="text-sm text-gray-600">학습한 내용을 테스트로 확인해보세요</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
            {CATEGORIES.map((category) => {
              const unreadCount = getUnreadCount(category.id)
              const isActive = activeTab === category.id

              return (
                <button
                  key={category.id}
                  onClick={() => handleTabChange(category.id)}
                  className={`relative flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {category.label}
                  {unreadCount > 0 && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* 서브카테고리 필터 칩 */}
      {currentSubCategories.length > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSubCategory(null)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activeSubCategory === null
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          {currentSubCategories.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setActiveSubCategory(activeSubCategory === sc.name ? null : sc.name)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                activeSubCategory === sc.name
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {sc.name}
            </button>
          ))}
        </div>
      )}

      {/* 게시물 목록 */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              게시물 없음
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeSubCategory
                ? `"${activeSubCategory}" 유형에 교육 자료가 없습니다.`
                : '이 카테고리에는 아직 교육 자료가 없습니다.'}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              title={post.title}
              contentType={post.content_type}
              category={post.category}
              createdAt={post.created_at}
              isRead={post.isRead}
            />
          ))
        )}
      </div>

      {/* 요약 정보 */}
      {filteredPosts.length > 0 && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              전체 {filteredPosts.length}개 자료
            </span>
            <span className="text-gray-600">
              읽음: {filteredPosts.filter((p) => p.isRead).length}개 / 미확인:{' '}
              {filteredPosts.filter((p) => !p.isRead).length}개
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
