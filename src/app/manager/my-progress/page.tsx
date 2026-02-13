// Created: 2026-01-27 16:30:00
import { createClient } from '@/lib/supabase/server'
import ProgressContent from './ProgressContent'

interface ReadStatus {
  post_id: string
  is_read: boolean
  read_at: string | null
}

interface Post {
  id: string
  title: string
  category: string
  content_type: 'video' | 'document'
  created_at: string
}

interface PostWithReadStatus extends Post {
  isRead: boolean
  readAt: string | null
}

export default async function MyProgressPage() {
  const supabase = await createClient()

  // 현재 사용자 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 모든 교육 게시물 조회
  const { data: posts } = await supabase
    .from('educational_posts')
    .select('id, title, category, content_type, created_at')
    .order('created_at', { ascending: false })

  // 사용자의 읽음 상태 조회
  const { data: readStatuses } = await supabase
    .from('read_status')
    .select('post_id, is_read, read_at')
    .eq('user_id', user.id)

  // 읽음 상태를 Map으로 변환
  const readStatusMap = new Map<string, { isRead: boolean; readAt: string | null }>(
    readStatuses?.map((rs: ReadStatus) => [rs.post_id, { isRead: rs.is_read, readAt: rs.read_at }]) || []
  )

  // 게시물에 읽음 상태 추가
  const postsWithReadStatus: PostWithReadStatus[] = (posts || []).map((post: Post) => ({
    ...post,
    isRead: readStatusMap.get(post.id)?.isRead || false,
    readAt: readStatusMap.get(post.id)?.readAt || null,
  }))

  // 카테고리별 통계 계산
  const categories = ['남자_매니저_대화', '여자_매니저_대화', '여자_매니저_소개', '추가_서비스_규칙', '개인_피드백']
  const categoryStats = categories.map((category) => {
    const categoryPosts = postsWithReadStatus.filter((p: PostWithReadStatus) => p.category === category)
    const readCount = categoryPosts.filter((p: PostWithReadStatus) => p.isRead).length
    return {
      category,
      total: categoryPosts.length,
      read: readCount,
    }
  })

  return (
    <ProgressContent
      posts={postsWithReadStatus}
      categoryStats={categoryStats}
    />
  )
}
