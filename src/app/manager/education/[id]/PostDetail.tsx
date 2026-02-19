// Created: 2026-01-27 16:30:00
'use client'

import { useEffect, useState } from 'react'

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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'

interface Post {
  id: string
  title: string
  content_type: 'video' | 'document'
  content: string
  category: string
  external_link: string | null
  created_at: string
  updated_at: string
  author_id: string
}

interface RelatedQuestion {
  id: string
  question: string
  question_type: 'multiple_choice' | 'subjective'
  question_image_url: string | null
  options: string[] | null
  correct_answer: number[] | null
  max_score: number
}

interface Comment {
  id: string
  post_id: string
  author_id: string
  author_name: string
  content: string
  display_nickname: string | null
  created_at: string
}

interface PostDetailProps {
  post: Post
  userId: string
  userRole: string
  hasRelatedTest: boolean
  relatedQuestions?: RelatedQuestion[]
  comments?: Comment[]
  nicknames?: string[]
}

export default function PostDetail({
  post,
  userId,
  userRole,
  hasRelatedTest,
  relatedQuestions = [],
  comments: initialComments = [],
  nicknames = [],
}: PostDetailProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showRelatedTests, setShowRelatedTests] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Comment state
  const [newComment, setNewComment] = useState('')
  const [selectedNickname, setSelectedNickname] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

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

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
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
      '개인_피드백': '개인 피드백',
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

  // Comment handlers - 클라이언트 Supabase 직접 사용 (meeting_comments와 동일 방식)
  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmittingComment) return
    setIsSubmittingComment(true)

    try {
      const { error } = await supabase.from('education_comments').insert({
        post_id: post.id,
        author_id: userId,
        content: newComment.trim(),
        display_nickname: selectedNickname || null,
      })

      if (error) throw error

      setNewComment('')
      setSelectedNickname('')
      router.refresh()
    } catch (err: any) {
      console.error('Comment error:', err)
      alert('댓글 등록 중 오류가 발생했습니다.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('education_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      router.refresh()
    } catch (err: any) {
      console.error('Delete comment error:', err)
      alert('댓글 삭제 중 오류가 발생했습니다.')
    }
  }

  // 게시물 삭제 핸들러
  const handleDeletePost = async () => {
    setIsDeletingPost(true)
    try {
      const { error } = await supabase
        .from('educational_posts')
        .delete()
        .eq('id', post.id)

      if (error) throw error

      router.push('/manager/education')
    } catch (err: any) {
      console.error('Delete post error:', err)
      alert('게시물 삭제 중 오류가 발생했습니다.')
      setIsDeletingPost(false)
      setShowDeleteConfirm(false)
    }
  }

  const renderCommentAuthor = (comment: Comment) => {
    if (comment.display_nickname) {
      return (
        <>
          <span className="text-sm font-semibold text-gray-900">
            {comment.display_nickname}
          </span>
          <span className="text-xs text-gray-400">
            ({comment.author_name})
          </span>
        </>
      )
    }
    return (
      <span className="text-sm font-medium text-gray-900">
        {comment.author_name}
      </span>
    )
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
          {/* 카테고리 & 타입 & 삭제 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
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
            {(post.author_id === userId || userRole === 'admin') && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              >
                삭제
              </button>
            )}
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

          {/* 외부 링크 (Flow 등) */}
          {post.external_link && (
            <div className="mt-4">
              <a
                href={post.external_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                원본 자료 보기 (Flow)
              </a>
            </div>
          )}
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
            <div className="markdown-content max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="block max-w-full h-auto rounded-lg my-6 shadow-md cursor-zoom-in mx-auto"
                      loading="lazy"
                      onClick={(e) => setLightboxSrc((e.target as HTMLImageElement).src)}
                    />
                  ),
                }}
              >
                {post.content}
              </ReactMarkdown>
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
          <button
            onClick={() => setShowRelatedTests(!showRelatedTests)}
            className={`flex-1 px-6 py-3 font-medium rounded-lg text-center transition-colors flex items-center justify-center gap-2 ${
              showRelatedTests
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            {showRelatedTests ? '테스트 숨기기' : `관련 테스트 보기 (${relatedQuestions.length}문제)`}
          </button>
        )}
      </div>

      {/* 관련 테스트 문제 목록 */}
      {showRelatedTests && relatedQuestions.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-primary-50 border-b border-primary-100">
            <h2 className="font-semibold text-primary-900">
              관련 테스트 문제 ({relatedQuestions.length}개)
            </h2>
            <p className="text-sm text-primary-700 mt-1">이 교육 자료와 연결된 테스트 문제입니다.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {relatedQuestions.map((q, index) => (
              <div key={q.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        q.question_type === 'multiple_choice'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {q.question_type === 'multiple_choice' ? '객관식' : '주관식'}
                      </span>
                      <span className="text-xs text-gray-500">{q.max_score}점</span>
                    </div>
                    <p className="text-gray-900 font-medium">{q.question}</p>
                    {parseQuestionImages(q.question_image_url).map((imgUrl, imgIdx) => (
                      <img key={imgIdx} src={imgUrl} alt={`문제 이미지 ${imgIdx + 1}`} className="mt-2 max-h-32 rounded border" />
                    ))}
                    {q.question_type === 'multiple_choice' && q.options && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
                        {q.options.map((opt, i) => {
                          const isCorrect = Array.isArray(q.correct_answer)
                            ? q.correct_answer.includes(i)
                            : i === (q.correct_answer as unknown as number)
                          return (
                          <div
                            key={i}
                            className={`p-1.5 rounded ${
                              isCorrect
                                ? 'bg-green-50 text-green-800 font-medium'
                                : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {i + 1}. {opt}
                            {isCorrect && <span className="ml-1 text-green-600">✓</span>}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <Link
              href={`/manager/test/${encodeURIComponent(post.category)}?postId=${post.id}`}
              className="w-full block text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              이 교육 자료 테스트 응시하기
            </Link>
          </div>
        </div>
      )}

      {/* 댓글 섹션 */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            댓글
            <span className="ml-2 text-sm font-normal text-gray-500">
              {initialComments.length}개
            </span>
          </h2>
        </div>

        {/* 댓글 목록 */}
        {initialComments.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {initialComments.map((comment) => (
              <div key={comment.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {(comment.display_nickname || comment.author_name).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {renderCommentAuthor(comment)}
                        <span className="text-xs text-gray-400">
                          {formatRelativeDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                  {(comment.author_id === userId || userRole === 'admin') && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="댓글 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-400">
            아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
          </div>
        )}

        {/* 댓글 작성 */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              {/* 닉네임 드롭다운 */}
              {nicknames.length > 0 && (
                <div className="mb-2">
                  <select
                    value={selectedNickname}
                    onChange={(e) => setSelectedNickname(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  >
                    <option value="">닉네임 선택 (선택사항)</option>
                    {nicknames.map((nick) => (
                      <option key={nick} value={nick}>
                        {nick}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleAddComment()
                  }
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">Ctrl+Enter로 등록</span>
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingComment ? '등록 중...' : '댓글 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* 이미지 확대 모달 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxSrc}
              alt="확대 이미지"
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            />
            <button
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-600 hover:text-gray-900"
              onClick={() => setLightboxSrc(null)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">게시물 삭제</h3>
            <p className="text-sm text-gray-600 mb-6">
              이 교육 자료를 삭제하시겠습니까? 삭제된 자료는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingPost}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeletePost}
                disabled={isDeletingPost}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeletingPost ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
