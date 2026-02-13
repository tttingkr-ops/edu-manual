// Created: 2026-01-27 16:30:00
'use client'

import { useState } from 'react'
import Link from 'next/link'
import ProgressBar from '@/components/ProgressBar'

interface Post {
  id: string
  title: string
  category: string
  content_type: 'video' | 'document'
  created_at: string
  isRead: boolean
  readAt: string | null
}

interface CategoryStat {
  category: string
  total: number
  read: number
}

interface ProgressContentProps {
  posts: Post[]
  categoryStats: CategoryStat[]
}

const CATEGORY_LABELS: Record<string, string> = {
  '남자_매니저_대화': '남자 매니저 대화',
  '여자_매니저_대화': '여자 매니저 대화',
  '여자_매니저_소개': '여자 매니저 소개',
  '추가_서비스_규칙': '추가 서비스 규칙',
  '개인_피드백': '개인 피드백',
}

export default function ProgressContent({
  posts,
  categoryStats,
}: ProgressContentProps) {
  const [activeView, setActiveView] = useState<'read' | 'unread'>('unread')

  const readPosts = posts.filter((p) => p.isRead)
  const unreadPosts = posts.filter((p) => !p.isRead)

  const totalPosts = posts.length
  const totalRead = readPosts.length
  const overallPercentage = totalPosts > 0 ? Math.round((totalRead / totalPosts) * 100) : 0

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">학습 현황</h1>
        <p className="mt-2 text-gray-600">
          교육 자료 학습 진행 상황을 확인하세요.
        </p>
      </div>

      {/* 전체 진행률 카드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">전체 학습 진행률</h2>
          <span className="text-3xl font-bold text-primary-600">
            {overallPercentage}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
          <div
            className="bg-primary-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-600">
          <span>완료: {totalRead}개</span>
          <span>미완료: {totalPosts - totalRead}개</span>
          <span>전체: {totalPosts}개</span>
        </div>
      </div>

      {/* 카테고리별 진행률 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          카테고리별 학습 현황
        </h2>

        <div className="space-y-6">
          {categoryStats.map((stat) => {
            const percentage = stat.total > 0 ? Math.round((stat.read / stat.total) * 100) : 0
            let color: 'green' | 'orange' | 'red' | 'primary' = 'primary'
            if (percentage === 100) color = 'green'
            else if (percentage >= 50) color = 'orange'
            else if (percentage > 0) color = 'red'

            return (
              <ProgressBar
                key={stat.category}
                label={CATEGORY_LABELS[stat.category] || stat.category}
                current={stat.read}
                total={stat.total}
                color={stat.total === 0 ? 'primary' : color}
                size="md"
              />
            )
          })}
        </div>
      </div>

      {/* 게시물 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 탭 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveView('unread')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeView === 'unread'
                ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            미확인 자료
            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
              {unreadPosts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveView('read')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeView === 'read'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            읽은 자료
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              {readPosts.length}
            </span>
          </button>
        </div>

        {/* 목록 */}
        <div className="divide-y divide-gray-200">
          {(activeView === 'unread' ? unreadPosts : readPosts).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {activeView === 'unread'
                ? '모든 교육 자료를 확인하셨습니다!'
                : '아직 확인한 교육 자료가 없습니다.'}
            </div>
          ) : (
            (activeView === 'unread' ? unreadPosts : readPosts).map((post) => (
              <Link
                key={post.id}
                href={`/manager/education/${post.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* 콘텐츠 타입 아이콘 */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        post.content_type === 'video'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {post.content_type === 'video' ? (
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
                      ) : (
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
                      )}
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900">{post.title}</h3>
                      <p className="text-sm text-gray-500">
                        {CATEGORY_LABELS[post.category] || post.category}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {post.isRead && post.readAt && (
                      <p className="text-xs text-gray-500">
                        {formatDate(post.readAt)} 읽음
                      </p>
                    )}
                    <svg
                      className="w-5 h-5 text-gray-400 ml-auto mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
