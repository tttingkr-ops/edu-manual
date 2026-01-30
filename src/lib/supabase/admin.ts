// Created: 2026-01-29 10:00:00
// Supabase Admin Client with SERVICE_ROLE_KEY for server-side auth operations
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Admin client bypasses RLS - use only for auth operations on the server
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
