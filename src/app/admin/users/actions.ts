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
  role: 'admin' | 'manager'
}

interface UpdateUserInput {
  userId: string
  username: string
  name: string
  role: 'admin' | 'manager'
}

export async function createUserAction(input: CreateUserInput) {
  const result = await createUserWithAuth(input.email, input.password, {
    username: input.username,
    name: input.name,
    role: input.role,
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
