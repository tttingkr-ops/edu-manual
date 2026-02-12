// Created: 2026-02-11 14:30:00
// Updated: 2026-02-12 - 상태(완료/미완), 긴급도, 데드라인 필터/정렬/표시 추가
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface MeetingPost {
  id: string
  title: string
  post_type: 'free' | 'poll'
  is_anonymous: boolean
  author_id: string
  author_name: string
  comment_count: number
  vote_count: number
  status: 'pending' | 'completed'
  priority: 'urgent' | 'high' | 'normal' | 'low' | null
  deadline: string | null
  created_at: string
}

interface MeetingsListProps {
  posts: MeetingPost[]
  currentUserId: string
  userRole: string
}

type FilterType = 'all' | 'free' | 'poll'
type StatusFilter = 'all' | 'pending' | 'completed'
type SortType = 'latest' | 'priority' | 'deadline'

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string; order: number }> = {
  urgent: { label: '긴급', color: 'text-red-700', bgColor: 'bg-red-100 border-red-200', order: 0 },
  high: { label: '높음', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-200', order: 1 },
  normal: { label: '보통', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-200', order: 2 },
  low: { label: '낮음', color: 'text-gray-600', bgColor: 'bg-gray-100 border-gray-200', order: 3 },
}

export default function MeetingsList({ posts, currentUserId, userRole }: MeetingsListProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortType, setSortType] = useState<SortType>('latest')
  const [searchTerm, setSearchTerm] = useState('')

  // 데드라인까지 남은 일수 계산
  const getDaysUntilDeadline = (deadline: string | null): number | null => {
    if (!deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    return Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 데드라인 색상 결정 (3일+ 회색, 1~3일 주황, 당일/지남 빨강)
  const getDeadlineStyle = (deadline: string | null, status: string) => {
    if (!deadline || status === 'completed') return { color: 'text-gray-400', bold: false }
    const days = getDaysUntilDeadline(deadline)!
    if (days < 0) return { color: 'text-red-600', bold: true }
    if (days === 0) return { color: 'text-red-600', bold: true }
    if (days <= 3) return { color: 'text-orange-600', bold: true }
    return { color: 'text-gray-500', bold: false }
  }

  // 데드라인 텍스트
  const getDeadlineText = (deadline: string | null) => {
    if (!deadline) return ''
    const days = getDaysUntilDeadline(deadline)!
    const dateStr = new Date(deadline).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    if (days < 0) return `${dateStr} (${Math.abs(days)}일 지남)`
    if (days === 0) return `${dateStr} (오늘)`
    if (days === 1) return `${dateStr} (내일)`
    return `${dateStr} (${days}일 남음)`
  }

  // 필터링
  const filteredPosts = posts.filter((post) => {
    const matchesFilter = filter === 'all' || post.post_type === filter
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesStatus && matchesSearch
  })

  // 정렬
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    // 완료된 항목은 항상 아래로
    if (a.status !== b.status) {
      return a.status === 'completed' ? 1 : -1
    }

    if (sortType === 'priority') {
      const aOrder = a.priority ? PRIORITY_CONFIG[a.priority]?.order ?? 99 : 99
      const bOrder = b.priority ? PRIORITY_CONFIG[b.priority]?.order ?? 99 : 99
      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }

    if (sortType === 'deadline') {
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity
      if (aDeadline !== bDeadline) return aDeadline - bDeadline
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }

    // latest (default)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const formatCreatedDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'free', label: '자유 게시글' },
    { value: 'poll', label: '투표' },
  ]

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '전체 상태' },
    { value: 'pending', label: '미완' },
    { value: 'completed', label: '완료' },
  ]

  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'latest', label: '최신순' },
    { value: 'priority', label: '긴급도순' },
    { value: 'deadline', label: '데드라인순' },
  ]

  const pendingCount = posts.filter(p => p.status === 'pending').length
  const completedCount = posts.filter(p => p.status === 'completed').length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회의 안건방</h1>
          <p className="text-sm text-gray-500 mt-1">
            미완 <span className="font-semibold text-primary-600">{pendingCount}</span>건 / 완료 <span className="font-semibold text-gray-600">{completedCount}</span>건
          </p>
        </div>
        <Link
          href="/meetings/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 안건 작성
        </Link>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 space-y-3">
        {/* 1행: 게시글 타입 필터 + 검색 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filter === f.value
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-xs opacity-80">
                  {f.value === 'all'
                    ? posts.length
                    : posts.filter((p) => p.post_type === f.value).length}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
              placeholder="제목으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* 2행: 상태 필터 + 정렬 */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {statusFilters.map((sf) => (
              <button
                key={sf.value}
                onClick={() => setStatusFilter(sf.value)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  statusFilter === sf.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'text-gray-500 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">정렬:</span>
            {sortOptions.map((so) => (
              <button
                key={so.value}
                onClick={() => setSortType(so.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  sortType === so.value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'text-gray-500 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {so.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 게시물 목록 */}
      {sortedPosts.length > 0 ? (
        <div className="space-y-3">
          {sortedPosts.map((post) => {
            const isCompleted = post.status === 'completed'
            const deadlineStyle = getDeadlineStyle(post.deadline, post.status)
            const priorityInfo = post.priority ? PRIORITY_CONFIG[post.priority] : null

            return (
              <Link
                key={post.id}
                href={`/meetings/${post.id}`}
                className={`block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all ${
                  isCompleted ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {/* 완료 체크 표시 */}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          완료
                        </span>
                      )}
                      {/* 긴급도 배지 */}
                      {priorityInfo && (
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${priorityInfo.bgColor} ${priorityInfo.color}`}>
                          {post.priority === 'urgent' && (
                            <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          )}
                          {priorityInfo.label}
                        </span>
                      )}
                      {/* 타입 배지 */}
                      {post.post_type === 'poll' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          투표
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          자유
                        </span>
                      )}
                      {post.is_anonymous && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          비밀 투표
                        </span>
                      )}
                      <h3 className={`text-base font-semibold truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {post.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{post.author_name}</span>
                      <span className="text-gray-300">|</span>
                      <span>{formatCreatedDate(post.created_at)}</span>
                      {/* 데드라인 표시 */}
                      {post.deadline && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className={`flex items-center gap-1 ${deadlineStyle.color} ${deadlineStyle.bold ? 'font-semibold' : ''}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {getDeadlineText(post.deadline)}
                          </span>
                        </>
                      )}
                      {post.comment_count > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {post.comment_count}
                          </span>
                        </>
                      )}
                      {post.post_type === 'poll' && post.vote_count > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            {post.vote_count}표
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 화살표 아이콘 */}
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-gray-500 mb-4">
            {searchTerm
              ? '검색 결과가 없습니다.'
              : statusFilter !== 'all'
              ? `${statusFilter === 'pending' ? '미완' : '완료'} 상태의 안건이 없습니다.`
              : '아직 등록된 안건이 없습니다.'}
          </p>
          <Link
            href="/meetings/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            첫 안건 작성하기
          </Link>
        </div>
      )}
    </div>
  )
}
