// Created: 2026-02-18 00:00:00
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditMeetingContent from './EditMeetingContent'

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const { data: post } = await supabase
    .from('meeting_posts')
    .select('id, title, content, post_type, priority, deadline, author_id')
    .eq('id', id)
    .single()

  if (!post) notFound()

  // 작성자 또는 관리자만 수정 가능
  if (post.author_id !== user.id && userData?.role !== 'admin') {
    redirect(`/meetings/${id}`)
  }

  return <EditMeetingContent post={post} />
}
