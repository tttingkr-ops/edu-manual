// Created: 2026-02-11 14:45:00
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MeetingPost {
  id: string
  title: string
  content: string | null
  post_type: 'free' | 'poll'
  is_anonymous: boolean
  allow_multiple: boolean
  author_id: string
  author_name: string
  created_at: string
}

interface Comment {
  id: string
  post_id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}

interface PollOption {
  id: string
  option_text: string
  sort_order: number
  vote_count: number
  voters: { name: string; nickname: string | null }[]
}

interface MeetingDetailProps {
  post: MeetingPost
  comments: Comment[]
  pollOptions: PollOption[]
  userVotes: string[]
  currentUserId: string
  userRole: string
}

export default function MeetingDetail({
  post,
  comments: initialComments,
  pollOptions,
  userVotes,
  currentUserId,
  userRole,
}: MeetingDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  // Comment state
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Poll state
  const [hasVoted, setHasVoted] = useState(userVotes.length > 0)
  const [localUserVotes, setLocalUserVotes] = useState<string[]>(userVotes)
  const [localOptions, setLocalOptions] = useState<PollOption[]>(pollOptions)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [isVoting, setIsVoting] = useState(false)

  const totalVotes = localOptions.reduce((sum, opt) => sum + opt.vote_count, 0)

  const canDelete = post.author_id === currentUserId || userRole === 'admin'

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

  // Vote handler for single select
  const handleSingleVote = async (optionId: string) => {
    if (hasVoted || isVoting) return
    setIsVoting(true)

    try {
      const { error } = await supabase.from('meeting_votes').insert({
        post_id: post.id,
        option_id: optionId,
        user_id: currentUserId,
      })

      if (error) throw error

      setHasVoted(true)
      setLocalUserVotes([optionId])
      setLocalOptions((prev) =>
        prev.map((opt) =>
          opt.id === optionId ? { ...opt, vote_count: opt.vote_count + 1 } : opt
        )
      )
      router.refresh()
    } catch (err: any) {
      console.error('Vote error:', err)
      alert('투표 중 오류가 발생했습니다.')
    } finally {
      setIsVoting(false)
    }
  }

  // Vote handler for multiple select
  const handleMultiVote = async () => {
    if (hasVoted || isVoting || selectedOptions.length === 0) return
    setIsVoting(true)

    try {
      const inserts = selectedOptions.map((optId) => ({
        post_id: post.id,
        option_id: optId,
        user_id: currentUserId,
      }))

      const { error } = await supabase.from('meeting_votes').insert(inserts)

      if (error) throw error

      setHasVoted(true)
      setLocalUserVotes(selectedOptions)
      setLocalOptions((prev) =>
        prev.map((opt) => ({
          ...opt,
          vote_count: selectedOptions.includes(opt.id)
            ? opt.vote_count + 1
            : opt.vote_count,
        }))
      )
      router.refresh()
    } catch (err: any) {
      console.error('Vote error:', err)
      alert('투표 중 오류가 발생했습니다.')
    } finally {
      setIsVoting(false)
    }
  }

  const toggleOption = (optionId: string) => {
    setSelectedOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    )
  }

  // Comment handlers
  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmittingComment) return
    setIsSubmittingComment(true)

    try {
      const { error } = await supabase.from('meeting_comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        content: newComment.trim(),
      })

      if (error) throw error

      setNewComment('')
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
        .from('meeting_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      router.refresh()
    } catch (err: any) {
      console.error('Delete comment error:', err)
      alert('댓글 삭제 중 오류가 발생했습니다.')
    }
  }

  // Post delete handler
  const handleDeletePost = async () => {
    if (!confirm('정말 이 안건을 삭제하시겠습니까? 모든 댓글과 투표도 함께 삭제됩니다.')) return

    try {
      // Delete in order: votes, options, comments, then post
      await supabase.from('meeting_votes').delete().eq('post_id', post.id)
      await supabase.from('meeting_poll_options').delete().eq('post_id', post.id)
      await supabase.from('meeting_comments').delete().eq('post_id', post.id)
      const { error } = await supabase.from('meeting_posts').delete().eq('id', post.id)

      if (error) throw error

      router.push('/meetings')
    } catch (err: any) {
      console.error('Delete post error:', err)
      alert('안건 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/meetings" className="hover:text-primary-600">
          회의 안건방
        </Link>
        <span>/</span>
        <span className="truncate max-w-xs">{post.title}</span>
      </div>

      {/* 게시글 카드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
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
                {post.is_anonymous && post.post_type === 'poll' && (
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    비밀 투표
                  </span>
                )}
                {post.allow_multiple && post.post_type === 'poll' && (
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    중복 선택
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="font-medium text-gray-700">{post.author_name}</span>
                <span className="text-gray-300">|</span>
                <span>{formatDate(post.created_at)}</span>
              </div>
            </div>
            {canDelete && (
              <button
                onClick={handleDeletePost}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="삭제"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-6">
          {/* 자유 게시글: 마크다운 렌더링 */}
          {post.post_type === 'free' && post.content && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
            </div>
          )}

          {/* 투표: 투표 UI */}
          {post.post_type === 'poll' && (
            <div>
              {/* 아직 투표하지 않은 경우 */}
              {!hasVoted ? (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    {post.allow_multiple
                      ? '여러 항목을 선택할 수 있습니다. 선택 후 투표 버튼을 눌러주세요.'
                      : '하나의 항목을 선택하면 바로 투표됩니다.'}
                  </p>
                  <div className="space-y-2">
                    {localOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          if (post.allow_multiple) {
                            toggleOption(option.id)
                          } else {
                            handleSingleVote(option.id)
                          }
                        }}
                        disabled={isVoting}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          post.allow_multiple && selectedOptions.includes(option.id)
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-center gap-3">
                          {post.allow_multiple ? (
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                selectedOptions.includes(option.id)
                                  ? 'border-purple-500 bg-purple-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedOptions.includes(option.id) && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          )}
                          <span className="font-medium text-gray-900">{option.option_text}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {post.allow_multiple && (
                    <button
                      onClick={handleMultiVote}
                      disabled={isVoting || selectedOptions.length === 0}
                      className="mt-4 w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isVoting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          투표 중...
                        </span>
                      ) : (
                        `투표하기 (${selectedOptions.length}개 선택)`
                      )}
                    </button>
                  )}
                </div>
              ) : (
                /* 투표 결과 표시 */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">
                      총 <span className="font-semibold text-gray-900">{totalVotes}</span>표
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      투표 완료
                    </span>
                  </div>
                  <div className="space-y-3">
                    {localOptions.map((option) => {
                      const percentage = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0
                      const isMyVote = localUserVotes.includes(option.id)

                      return (
                        <div
                          key={option.id}
                          className={`relative p-4 rounded-lg border ${
                            isMyVote ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {option.option_text}
                                </span>
                                {isMyVote && (
                                  <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-purple-200 text-purple-800">
                                    내 선택
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-700">
                                {option.vote_count}표 ({percentage}%)
                              </span>
                            </div>
                            {/* 진행 바 */}
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isMyVote ? 'bg-purple-500' : 'bg-primary-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            {/* 투표자 표시 (비밀 투표가 아닌 경우) */}
                            {!post.is_anonymous && option.voters.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {option.voters.map((voter, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex px-2 py-0.5 text-xs rounded-full bg-white border border-gray-200 text-gray-600"
                                  >
                                    {voter.nickname || voter.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 댓글 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
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
                      {comment.author_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {comment.author_name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatRelativeDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                  {(comment.author_id === currentUserId || userRole === 'admin') && (
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
    </div>
  )
}
