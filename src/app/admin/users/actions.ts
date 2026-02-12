// Created: 2026-01-29 11:00:00
// Server Actions for user management
'use server'

import { revalidatePath } from 'next/cache'
import { createUserWithAuth, deleteUserWithAuth, resetUserPassword } from '@/lib/auth-utils'
import { createAdminClient } from '@/lib/supabase/admin'

interface CreateUserInput {
  email: string
  password: string
  username: string
  name: string
  nickname?: string
  role: 'admin' | 'manager'
}

interface UpdateUserInput {
  userId: string
  username: string
  name: string
  nickname?: string
  role: 'admin' | 'manager'
}

export async function createUserAction(input: CreateUserInput) {
  const result = await createUserWithAuth(input.email, input.password, {
    username: input.username,
    name: input.name,
    role: input.role,
    nickname: input.nickname,
  })

  if (result.success) {
    revalidatePath('/admin/users')
  }

  return result
}

export async function updateUserAction(input: UpdateUserInput) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('users')
      .update({
        username: input.username,
        name: input.name,
        nickname: input.nickname || null,
        role: input.role,
      })
      .eq('id', input.userId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

export async function deleteUserAction(userId: string) {
  const result = await deleteUserWithAuth(userId)

  if (result.success) {
    revalidatePath('/admin/users')
  }

  return result
}

export async function resetPasswordAction(userId: string, newPassword: string) {
  const result = await resetUserPassword(userId, newPassword)
  return result
}

// ========== Group Management Actions ==========

export async function fetchGroupsAction() {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred', data: [] }
  }
}

export async function createGroupAction(name: string) {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('groups')
      .insert({ name })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/users')
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

export async function updateGroupAction(groupId: string, name: string) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('groups')
      .update({ name })
      .eq('id', groupId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

export async function deleteGroupAction(groupId: string) {
  const supabase = createAdminClient()

  try {
    // Delete user_groups associations first
    await supabase.from('user_groups').delete().eq('group_id', groupId)

    // Delete the group
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

// ========== User-Group Assignment Actions ==========

export async function updateUserGroupsAction(userId: string, groupIds: string[]) {
  const supabase = createAdminClient()

  try {
    // Delete all existing user_groups for this user
    const { error: deleteError } = await supabase
      .from('user_groups')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    // Insert new user_groups
    if (groupIds.length > 0) {
      const rows = groupIds.map((groupId) => ({
        user_id: userId,
        group_id: groupId,
      }))

      const { error: insertError } = await supabase
        .from('user_groups')
        .insert(rows)

      if (insertError) {
        return { success: false, error: insertError.message }
      }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}
