// Created: 2026-02-11 14:40:00
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MeetingDetail from './MeetingDetail'

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // Fetch post with author
  const { data: post } = await supabase
    .from('meeting_posts')
    .select('*, users!meeting_posts_author_id_fkey(username, nickname)')
    .eq('id', id)
    .single()

  if (!post) notFound()

  // Fetch comments with authors
  const { data: comments } = await supabase
    .from('meeting_comments')
    .select('*, users!meeting_comments_author_id_fkey(username, nickname)')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  // 닉네임 목록 조회 (users 테이블에서 nickname이 있는 사용자)
  const { data: nicknameUsers } = await supabase
    .from('users')
    .select('nickname')
    .not('nickname', 'is', null)

  const nicknames = (nicknameUsers || [])
    .map((u: any) => u.nickname)
    .filter((n: string | null): n is string => !!n)

  // For polls: fetch options with vote counts
  let pollOptions: any[] = []
  let userVotes: string[] = []

  if (post.post_type === 'poll') {
    const { data: options } = await supabase
      .from('meeting_poll_options')
      .select('*')
      .eq('post_id', id)
      .order('sort_order')

    // Get all votes for this post
    const { data: allVotes } = await supabase
      .from('meeting_votes')
      .select('option_id, user_id, users!meeting_votes_user_id_fkey(username, nickname)')
      .eq('post_id', id)

    // Count votes per option and collect voter names
    const voteCountMap: Record<string, number> = {}
    const voterMap: Record<string, { username: string; nickname: string | null }[]> = {}

    for (const v of allVotes || []) {
      voteCountMap[v.option_id] = (voteCountMap[v.option_id] || 0) + 1
      if (!voterMap[v.option_id]) voterMap[v.option_id] = []
      voterMap[v.option_id].push(v.users as any)
      if (v.user_id === user.id) userVotes.push(v.option_id)
    }

    pollOptions = (options || []).map((opt: any) => ({
      ...opt,
      vote_count: voteCountMap[opt.id] || 0,
      voters: voterMap[opt.id] || [],
    }))
  }

  return (
    <MeetingDetail
      post={{
        ...post,
        author_name: post.users?.nickname || post.users?.username || '알 수 없음',
      }}
      comments={(comments || []).map((c: any) => ({
        ...c,
        author_name: c.users?.nickname || c.users?.username || '알 수 없음',
      }))}
      pollOptions={pollOptions}
      userVotes={userVotes}
      currentUserId={user.id}
      userRole={userData?.role || 'manager'}
      nicknames={nicknames}
    />
  )
}
