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
  status: 'pending' | 'completed'
  priority: 'urgent' | 'high' | 'normal' | 'low' | null
  deadline: string | null
  created_at: string
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  urgent: { label: '긴급', color: 'text-red-700', bgColor: 'bg-red-100 border-red-200' },
  high: { label: '높음', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-200' },
  normal: { label: '보통', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-200' },
  low: { label: '낮음', color: 'text-gray-600', bgColor: 'bg-gray-100 border-gray-200' },
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

interface PollOption {
  id: string
  option_text: string
  sort_order: number
  vote_count: number
  voters: { username: string; nickname: string | null }[]
}

interface MeetingDetailProps {
  post: MeetingPost
  comments: Comment[]
  pollOptions: PollOption[]
  userVotes: string[]
  currentUserId: string
  userRole: string
  nicknames?: string[]
}

const EDU_CATEGORIES = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙' },
]

export default function MeetingDetail({
  post,
  comments: initialComments,
  pollOptions,
  userVotes,
  currentUserId,
  userRole,
  nicknames = [],
}: MeetingDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  // Status state
  const [localStatus, setLocalStatus] = useState<'pending' | 'completed'>(post.status)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Copy to education modal state
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyCategory, setCopyCategory] = useState<string>('남자_매니저_대화')
  const [isCopying, setIsCopying] = useState(false)

  // Comment state
  const [newComment, setNewComment] = useState('')
  const [selectedNickname, setSelectedNickname] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Poll state
  const [hasVoted, setHasVoted] = useState(userVotes.length > 0)
  const [localUserVotes, setLocalUserVotes] = useState<string[]>(userVotes)
  const [localOptions, setLocalOptions] = useState<PollOption[]>(pollOptions)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [isVoting, setIsVoting] = useState(false)

  const totalVotes = localOptions.reduce((sum, opt) => sum + opt.vote_count, 0)

  const canDelete = post.author_id === currentUserId || userRole === 'admin'
  const canEdit = post.author_id === currentUserId || userRole === 'admin'
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // 데드라인 헬퍼
  const getDaysUntilDeadline = (deadline: string | null): number | null => {
    if (!deadline) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    return Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getDeadlineStyle = (deadline: string | null) => {
    if (!deadline || localStatus === 'completed') return { color: 'text-gray-400', bold: false }
    const days = getDaysUntilDeadline(deadline)!
    if (days <= 0) return { color: 'text-red-600', bold: true }
    if (days <= 3) return { color: 'text-orange-600', bold: true }
    return { color: 'text-gray-500', bold: false }
  }

  const getDeadlineText = (deadline: string | null) => {
    if (!deadline) return ''
    const days = getDaysUntilDeadline(deadline)!
    const dateStr = new Date(deadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    if (days < 0) return `${dateStr} (${Math.abs(days)}일 지남)`
    if (days === 0) return `${dateStr} (오늘 마감)`
    if (days === 1) return `${dateStr} (내일 마감)`
    return `${dateStr} (${days}일 남음)`
  }

  // 투표 결과를 텍스트로 변환
  const buildPollResultText = () => {
    const totalVotesCount = localOptions.reduce((sum, opt) => sum + opt.vote_count, 0)
    let text = ''
    if (post.content) {
      text += post.content + '\n\n---\n\n'
    }
    text += '## 투표 결과\n\n'
    const sorted = [...localOptions].sort((a, b) => b.vote_count - a.vote_count)
    sorted.forEach((opt, i) => {
      const pct = totalVotesCount > 0 ? Math.round((opt.vote_count / totalVotesCount) * 100) : 0
      const prefix = i === 0 && opt.vote_count > 0 ? ' (최다 득표)' : ''
      text += `- **${opt.option_text}**: ${opt.vote_count}표 (${pct}%)${prefix}\n`
    })
    text += `\n> 총 ${totalVotesCount}표 참여`
    return text
  }

  // 교육 자료로 복사
  const handleCopyToEducation = async () => {
    setIsCopying(true)
    try {
      const content = post.post_type === 'poll'
        ? buildPollResultText()
        : post.content || ''

      const { error } = await supabase
        .from('educational_posts')
        .insert({
          title: post.title,
          content,
          content_type: 'document' as const,
          category: copyCategory as '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백',
          author_id: currentUserId,
          approval_status: 'approved' as const,
        })

      if (error) throw error

      alert('교육 자료로 복사되었습니다.')
      setShowCopyModal(false)
    } catch (err: any) {
      console.error('Copy to education error:', err)
      alert('교육 자료 복사 중 오류가 발생했습니다.')
    } finally {
      setIsCopying(false)
    }
  }

  // 상태 토글
  const handleToggleStatus = async () => {
    const newStatus = localStatus === 'pending' ? 'completed' : 'pending'

    // pending → completed 일 때 교육자료 복사 여부 확인
    if (newStatus === 'completed') {
      const wantCopy = confirm('완료 처리하시겠습니까?\n\n교육 자료로 복사하려면 "확인"을,\n단순 완료만 하려면 "취소"를 누르세요.')
      if (wantCopy) {
        // 먼저 상태 변경
        setIsTogglingStatus(true)
        try {
          const { error } = await supabase
            .from('meeting_posts')
            .update({ status: newStatus })
            .eq('id', post.id)
          if (error) throw error
          setLocalStatus(newStatus)
          router.refresh()
        } catch (err: any) {
          console.error('Status toggle error:', err)
          alert('상태 변경 중 오류가 발생했습니다.')
          setIsTogglingStatus(false)
          return
        }
        setIsTogglingStatus(false)
        // 카테고리 선택 모달 열기
        setShowCopyModal(true)
        return
      }
      // 단순 완료 처리 - 아래로 계속
    }

    setIsTogglingStatus(true)
    try {
      const { error } = await supabase
        .from('meeting_posts')
        .update({ status: newStatus })
        .eq('id', post.id)
      if (error) throw error
      setLocalStatus(newStatus)
      router.refresh()
    } catch (err: any) {
      console.error('Status toggle error:', err)
      alert('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsTogglingStatus(false)
    }
  }

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
      {/* 뒤로가기 + 브레드크럼 */}
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-3 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        목록으로 돌아가기
      </Link>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/meetings" className="hover:text-primary-600">
          회의 안건방
        </Link>
        <span>/</span>
        <span className="truncate max-w-xs">{post.title}</span>
      </div>

      {/* 게시글 카드 */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 mb-6 ${localStatus === 'completed' ? 'opacity-70' : ''}`}>
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* 완료 상태 배지 */}
                {localStatus === 'completed' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    논의 완료
                  </span>
                )}
                {/* 긴급도 배지 */}
                {post.priority && PRIORITY_CONFIG[post.priority] && (
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${PRIORITY_CONFIG[post.priority].bgColor} ${PRIORITY_CONFIG[post.priority].color}`}>
                    {post.priority === 'urgent' && (
                      <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    )}
                    {PRIORITY_CONFIG[post.priority].label}
                  </span>
                )}
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
              <h1 className={`text-xl font-bold mb-2 ${localStatus === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{post.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                <span className="font-medium text-gray-700">{post.author_name}</span>
                <span className="text-gray-300">|</span>
                <span>{formatDate(post.created_at)}</span>
                {/* 데드라인 표시 */}
                {post.deadline && (() => {
                  const style = getDeadlineStyle(post.deadline)
                  return (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className={`flex items-center gap-1 ${style.color} ${style.bold ? 'font-semibold' : ''}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {getDeadlineText(post.deadline)}
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 상태 토글 버튼 */}
              <button
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all disabled:opacity-50 ${
                  localStatus === 'completed'
                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-primary-400'
                }`}
                title={localStatus === 'completed' ? '미완으로 변경' : '완료로 변경'}
              >
                {localStatus === 'completed' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-4 h-4 rounded border-2 border-gray-400" />
                )}
                완료
              </button>
              {canEdit && (
                <Link
                  href={`/meetings/${post.id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  title="수정"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  수정
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={handleDeletePost}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="삭제"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-6">
          {/* 자유 게시글: 마크다운 렌더링 */}
          {post.post_type === 'free' && post.content && (
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

          {/* 투표: 설명 + 투표 UI */}
          {post.post_type === 'poll' && post.content && (
            <div className="mb-6 markdown-content max-w-none">
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
                                    {voter.nickname || voter.username}
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
                      {(comment.display_nickname || comment.author_name).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {comment.display_nickname ? (
                          <>
                            <span className="text-sm font-semibold text-gray-900">
                              {comment.display_nickname}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({comment.author_name})
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {comment.author_name}
                          </span>
                        )}
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

      {/* 교육 자료 복사 모달 */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">교육 자료로 복사</h2>
              <p className="text-sm text-gray-500 mt-1">
                이 안건을 교육 자료로 복사할 카테고리를 선택해주세요.
              </p>
            </div>
            <div className="p-6 space-y-3">
              {EDU_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    copyCategory === cat.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="copy_category"
                    value={cat.value}
                    checked={copyCategory === cat.value}
                    onChange={(e) => setCopyCategory(e.target.value)}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="font-medium text-gray-900">{cat.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCopyModal(false)}
                disabled={isCopying}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                건너뛰기
              </button>
              <button
                onClick={handleCopyToEducation}
                disabled={isCopying}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isCopying ? '복사 중...' : '복사하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
