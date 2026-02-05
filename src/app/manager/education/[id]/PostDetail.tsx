// Created: 2026-01-27 16:30:00
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'

interface Post {
  id: string
  title: string
  content_type: 'video' | 'document'
  content: string
  category: string
  created_at: string
  updated_at: string
  author_id: string
}

interface PostDetailProps {
  post: Post
  userId: string
  hasRelatedTest: boolean
}

export default function PostDetail({
  post,
  userId,
  hasRelatedTest,
}: PostDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  // 페이지 진입 시 읽음 상태 업데이트
  useEffect(() => {
    const markAsRead = async () => {
      await supabase.from('read_status').upsert(
        {
          user_id: userId,
          post_id: post.id,
          is_read: true,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,post_id',
        }
      )
    }

    markAsRead()
  }, [supabase, userId, post.id])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      '남자_매니저_대화': '남자 매니저 대화',
      '여자_매니저_대화': '여자 매니저 대화',
      '여자_매니저_소개': '여자 매니저 소개',
      '추가_서비스_규칙': '추가 서비스 규칙',
    }
    return labels[cat] || cat
  }

  // YouTube URL에서 비디오 ID 추출
  const getYouTubeVideoId = (url: string) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        목록으로 돌아가기
      </button>

      {/* 게시물 헤더 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          {/* 카테고리 & 타입 */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full">
              {getCategoryLabel(post.category)}
            </span>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                post.content_type === 'video'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {post.content_type === 'video' ? '영상' : '문서'}
            </span>
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {post.title}
          </h1>

          {/* 메타 정보 */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>작성일: {formatDate(post.created_at)}</span>
            {post.updated_at !== post.created_at && (
              <span>수정일: {formatDate(post.updated_at)}</span>
            )}
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {post.content_type === 'video' ? (
            // 비디오 콘텐츠
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {getYouTubeVideoId(post.content) ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(
                    post.content
                  )}`}
                  title={post.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-16 w-16 text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-400">
                      영상을 불러올 수 없습니다.
                    </p>
                    <a
                      href={post.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-primary-400 hover:text-primary-300"
                    >
                      외부 링크로 보기
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // 문서 콘텐츠 (마크다운)
            <div className="markdown-content prose prose-gray max-w-none">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* 하단 액션 버튼들 */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <Link
          href="/manager/education"
          className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-center transition-colors"
        >
          목록으로
        </Link>

        {hasRelatedTest && (
          <Link
            href={`/manager/test/${encodeURIComponent(post.category)}`}
            className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-center transition-colors flex items-center justify-center gap-2"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            관련 테스트 보기
          </Link>
        )}
      </div>

      {/* 학습 완료 알림 */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
        <svg
          className="w-6 h-6 text-green-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-green-700 text-sm">
          이 교육 자료를 확인하셨습니다. 학습 현황에 반영됩니다.
        </p>
      </div>
    </div>
  )
}
