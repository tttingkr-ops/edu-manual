// Created: 2026-01-29 11:00:00
// Auth utility functions for user management using Supabase Admin API
import { createAdminClient } from '@/lib/supabase/admin'

export interface CreateUserResult {
  success: boolean
  userId?: string
  error?: string
}

export interface DeleteUserResult {
  success: boolean
  error?: string
}

export interface ResetPasswordResult {
  success: boolean
  error?: string
}

/**
 * Create a new user with Supabase Auth and add to users table
 */
export async function createUserWithAuth(
  email: string,
  password: string,
  userData: {
    username: string
    name: string
    role: 'admin' | 'manager'
    nickname?: string
  }
): Promise<CreateUserResult> {
  const supabase = createAdminClient()

  try {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: userData.username,
        name: userData.name,
        role: userData.role,
      },
    })

    if (authError) {
      console.error('Auth user creation failed:', authError)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'User creation failed - no user returned' }
    }

    // 2. Insert into users table
    const { error: dbError } = await supabase.from('users').insert({
      id: authData.user.id,
      username: userData.username,
      name: userData.name,
      role: userData.role,
      nickname: userData.nickname || null,
    })

    if (dbError) {
      // Rollback: delete auth user if db insert fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.error('Database insert failed:', dbError)
      return { success: false, error: dbError.message }
    }

    return { success: true, userId: authData.user.id }
  } catch (error: any) {
    console.error('createUserWithAuth error:', error)
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

/**
 * Delete a user from both Supabase Auth and users table
 */
export async function deleteUserWithAuth(userId: string): Promise<DeleteUserResult> {
  const supabase = createAdminClient()

  try {
    // 1. Delete from users table first (due to foreign key constraints)
    const { error: dbError } = await supabase.from('users').delete().eq('id', userId)

    if (dbError) {
      console.error('Database delete failed:', dbError)
      return { success: false, error: dbError.message }
    }

    // 2. Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth user deletion failed:', authError)
      // Note: DB record is already deleted, but auth user remains
      // This is a partial failure state
      return { success: false, error: `Auth deletion failed: ${authError.message}` }
    }

    return { success: true }
  } catch (error: any) {
    console.error('deleteUserWithAuth error:', error)
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

/**
 * Reset a user's password
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      console.error('Password reset failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('resetUserPassword error:', error)
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}
