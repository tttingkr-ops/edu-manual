// Created: 2026-01-27 17:15:00
import { createClient } from '@/lib/supabase/server'
import PostsContent from './PostsContent'

export default async function PostsPage() {
  const supabase = await createClient()

  // 모든 교육 게시물 조회
  const { data: posts } = await supabase
    .from('educational_posts')
    .select('*')
    .order('created_at', { ascending: false })

  return <PostsContent posts={posts || []} />
}
