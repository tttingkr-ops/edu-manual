// Created: 2026-01-27 16:30:00
'use client'

import Link from 'next/link'

interface PostCardProps {
  id: string
  title: string
  contentType: 'video' | 'document'
  category: string
  createdAt: string
  isRead: boolean
  approvalStatus?: 'approved' | 'pending'
}

export default function PostCard({
  id,
  title,
  contentType,
  category,
  createdAt,
  isRead,
  approvalStatus,
}: PostCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      '남자_매니저_대화': '남자 매니저 대화',
      '여자_매니저_대화': '여자 매니저 대화',
      '여자_매니저_소개': '여자 매니저 소개',
      '추가_서비스_규칙': '추가 서비스 규칙',
      '개인_피드백': '개인 피드백',
    }
    return labels[cat] || cat
  }

  return (
    <Link href={`/manager/education/${id}`}>
      <div
        className={`relative p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-lg cursor-pointer ${
          isRead
            ? 'bg-white border-gray-200 hover:border-gray-300'
            : 'bg-primary-50 border-primary-300 hover:border-primary-400 ring-2 ring-primary-100'
        }`}
      >
        {/* 읽음 상태 뱃지 */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          {approvalStatus === 'pending' && (
            <span className="px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
              승인 대기중
            </span>
          )}
          {isRead ? (
            <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              읽음
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full animate-pulse">
              미확인
            </span>
          )}
        </div>

        {/* 콘텐츠 타입 아이콘 */}
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              contentType === 'video'
                ? 'bg-red-100 text-red-600'
                : 'bg-blue-100 text-blue-600'
            }`}
          >
            {contentType === 'video' ? (
              <svg
                className="w-6 h-6"
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
                className="w-6 h-6"
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

          <div className="flex-1 min-w-0">
            {/* 제목 */}
            <h3
              className={`text-lg font-semibold truncate pr-16 ${
                isRead ? 'text-gray-900' : 'text-primary-900'
              }`}
            >
              {title}
            </h3>

            {/* 메타 정보 */}
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                {getCategoryLabel(category)}
              </span>
              <span>{formatDate(createdAt)}</span>
              <span className="capitalize">
                {contentType === 'video' ? '영상' : '문서'}
              </span>
            </div>
          </div>
        </div>

        {/* 미확인 강조 표시 */}
        {!isRead && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-l-xl" />
        )}
      </div>
    </Link>
  )
}
