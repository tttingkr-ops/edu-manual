// Created: 2026-02-17 10:00:00
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { createClient } from '@/lib/supabase/client'

interface PendingPost {
  id: string
  title: string
  content_type: 'video' | 'document'
  content: string
  category: string
  sub_category: string | null
  targeting_type?: 'group' | 'individual'
  created_at: string
  author_id: string
  author_name: string
  author_nickname: string | null
  recipients?: { name: string }[]
}

interface PendingPostsContentProps {
  posts: PendingPost[]
}

const CATEGORY_LABELS: Record<string, string> = {
  '남자_매니저_대화': '남자 매니저 대화',
  '여자_매니저_대화': '여자 매니저 대화',
  '여자_매니저_소개': '여자 매니저 소개',
  '추가_서비스_규칙': '추가 서비스 규칙',
  '개인_피드백': '개인 피드백',
}

export default function PendingPostsContent({ posts: initialPosts }: PendingPostsContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState(initialPosts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleApprove = async (postId: string) => {
    setProcessingId(postId)
    try {
      const { error } = await supabase
        .from('educational_posts')
        .update({ approval_status: 'approved' })
        .eq('id', postId)

      if (error) throw error

      setPosts(posts.filter(p => p.id !== postId))
    } catch (err: any) {
      console.error('Approve error:', err)
      alert('승인 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('이 게시물을 삭제(반려)하시겠습니까?')) return

    setProcessingId(postId)
    try {
      await supabase.from('post_groups').delete().eq('post_id', postId)
      await supabase.from('post_target_users').delete().eq('post_id', postId)
      const { error } = await supabase
        .from('educational_posts')
        .delete()
        .eq('id', postId)

      if (error) throw error

      setPosts(posts.filter(p => p.id !== postId))
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-primary-600">대시보드</Link>
          <span>/</span>
          <Link href="/admin/posts" className="hover:text-primary-600">교육 게시물 관리</Link>
          <span>/</span>
          <span>승인 대기</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">승인 대기 게시물</h1>
        <p className="mt-1 text-gray-600">
          매니저가 작성한 게시물을 검토하고 승인, 수정 또는 반려할 수 있습니다.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 mb-2">승인 대기 중인 게시물이 없습니다.</p>
          <Link href="/admin/posts" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            교육 게시물 관리로 돌아가기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* 게시물 헤더 */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        승인 대기
                      </span>
                      <span className="px-2.5 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                        {CATEGORY_LABELS[post.category] || post.category}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        post.content_type === 'video'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {post.content_type === 'video' ? '영상' : '문서'}
                      </span>
                      {post.sub_category && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                          {post.sub_category}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{post.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                      <span>
                        작성자:{' '}
                        <span className="font-medium text-gray-700">{post.author_name}</span>
                      </span>
                      {post.targeting_type === 'individual' && post.recipients && post.recipients.length > 0 && (
                        <span>
                          수신자:{' '}
                          <span className="font-medium text-primary-700">
                            {post.recipients.map(r => r.name).join(', ')}
                          </span>
                        </span>
                      )}
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* 미리보기 토글 */}
                <button
                  onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                  className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <svg className={`w-4 h-4 transition-transform ${expandedId === post.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {expandedId === post.id ? '미리보기 접기' : '내용 미리보기'}
                </button>
              </div>

              {/* 내용 미리보기 */}
              {expandedId === post.id && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <div className="markdown-content prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      remarkRehypeOptions={{ allowDangerousHtml: true }}
                      components={{
                        img: ({ node, ...props }) => (
                          <img
                            {...props}
                            style={{ maxWidth: '100%', height: 'auto', borderRadius: '0.5rem' }}
                            loading="lazy"
                          />
                        ),
                      }}
                    >
                      {post.content.replace(
                        /<div class="image-row">([\s\S]*?)<\/div>/g,
                        (_m, inner: string) => `<div class="image-row">${inner.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_i: string, alt: string, url: string) => `<img src="${url}" alt="${alt}" />`)}</div>`
                      )}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2 justify-end">
                <button
                  onClick={() => handleDelete(post.id)}
                  disabled={processingId === post.id}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  삭제 (반려)
                </button>
                <Link
                  href={`/admin/posts/${post.id}/edit`}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  수정 후 승인
                </Link>
                <button
                  onClick={() => handleApprove(post.id)}
                  disabled={processingId === post.id}
                  className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {processingId === post.id ? '처리 중...' : '승인'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
