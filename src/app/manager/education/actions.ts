// Created: 2026-02-13 15:30:00
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function addCommentAction(postId: string, content: string, displayNickname: string | null) {
  // 인증 확인 (일반 클라이언트)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // admin client로 insert (education_comments FK가 auth.users 참조하므로 RLS 우회 필요)
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('education_comments').insert({
    post_id: postId,
    author_id: user.id,
    content,
    display_nickname: displayNickname,
  })

  if (error) {
    console.error('Comment insert error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteCommentAction(commentId: string) {
  // 인증 확인 (일반 클라이언트)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // admin client로 삭제 (작성자 확인은 서버에서)
  const adminClient = createAdminClient()

  // 작성자 또는 admin인지 확인
  const { data: comment } = await adminClient
    .from('education_comments')
    .select('author_id')
    .eq('id', commentId)
    .single()

  if (!comment) {
    return { success: false, error: '댓글을 찾을 수 없습니다.' }
  }

  const { data: userData } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (comment.author_id !== user.id && userData?.role !== 'admin') {
    return { success: false, error: '삭제 권한이 없습니다.' }
  }

  const { error } = await adminClient
    .from('education_comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Comment delete error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
