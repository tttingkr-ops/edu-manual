// Created: 2026-02-23 00:00:00
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import BestPracticeDetail from './BestPracticeDetail'

export default async function BestPracticeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: post, error } = await supabase
    .from('best_practice_posts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !post) notFound()

  return <BestPracticeDetail post={post} userId={user.id} />
}
