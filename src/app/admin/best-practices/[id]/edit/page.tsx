// Created: 2026-02-23 00:00:00
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditBestPracticeContent from './EditBestPracticeContent'

export default async function EditBestPracticePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [
    { data: post },
    { data: postGroups },
    { data: targetUsers },
    { data: groups },
    { data: managers },
  ] = await Promise.all([
    supabase.from('best_practice_posts').select('*').eq('id', params.id).single(),
    supabase.from('best_practice_groups').select('group_name').eq('post_id', params.id),
    supabase.from('best_practice_target_users').select('user_id').eq('post_id', params.id),
    supabase.from('groups').select('id, name').order('name'),
    supabase.from('users').select('id, username, nickname').eq('role', 'manager').order('username'),
  ])

  if (!post) notFound()

  return (
    <EditBestPracticeContent
      post={post}
      initialGroups={(postGroups || []).map(g => g.group_name)}
      initialTargetUsers={(targetUsers || []).map(t => t.user_id)}
      groups={groups || []}
      managers={managers || []}
    />
  )
}
