// Created: 2026-02-11 14:30:00
import { createClient } from '@/lib/supabase/server'
import MeetingsList from './MeetingsList'

export default async function MeetingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const { data: posts } = await supabase
    .from('meeting_posts')
    .select('*, users!meeting_posts_author_id_fkey(name, nickname)')
    .order('created_at', { ascending: false })

  // Get comment counts
  const { data: commentCounts } = await supabase
    .from('meeting_comments')
    .select('post_id')

  const commentCountMap: Record<string, number> = {}
  for (const c of commentCounts || []) {
    commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1
  }

  // Get vote counts for poll posts
  const { data: voteCounts } = await supabase
    .from('meeting_votes')
    .select('post_id')

  const voteCountMap: Record<string, number> = {}
  for (const v of voteCounts || []) {
    voteCountMap[v.post_id] = (voteCountMap[v.post_id] || 0) + 1
  }

  const postsWithCounts = (posts || []).map((post: any) => ({
    ...post,
    author_name: post.users?.nickname || post.users?.name || '알 수 없음',
    comment_count: commentCountMap[post.id] || 0,
    vote_count: voteCountMap[post.id] || 0,
  }))

  return (
    <MeetingsList
      posts={postsWithCounts}
      currentUserId={user.id}
      userRole={userData?.role || 'manager'}
    />
  )
}
