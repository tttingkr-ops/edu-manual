// Created: 2026-01-27 18:00:00
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditPostContent from './EditPostContent'
import { mockPosts } from '@/lib/mock-data'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 게시물 조회
  const { data: post } = await supabase
    .from('educational_posts')
    .select('*')
    .eq('id', id)
    .single()

  // Mock 모드에서 post가 없으면 mockPosts에서 찾기
  const foundPost = post || mockPosts.find((p) => p.id === id)

  if (!foundPost) {
    notFound()
  }

  return <EditPostContent post={foundPost} />
}
