// Created: 2026-01-27 16:30:00
// 브라우저(클라이언트)용 Supabase 클라이언트
'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

const MOCK_MODE =
  process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL

// Mock 클라이언트 (브라우저용)
function createMockBrowserClient() {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'admin@example.com',
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
        order: () => ({
          then: (resolve: any) => resolve({ data: [], error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }
}

export function createClient() {
  if (MOCK_MODE) {
    return createMockBrowserClient() as any
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
