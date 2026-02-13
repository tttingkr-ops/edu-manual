// Created: 2026-02-13 15:30:00
'use server'

import { createClient } from '@/lib/supabase/server'

export async function addCommentAction(postId: string, content: string, displayNickname: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const { error } = await supabase.from('education_comments').insert({
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
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const { error } = await supabase
    .from('education_comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Comment delete error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
