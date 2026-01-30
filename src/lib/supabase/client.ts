// Created: 2026-01-27 16:30:00
// Updated: 2026-01-29 - Mock 모드 제거, 실제 Supabase 연동
// 브라우저(클라이언트)용 Supabase 클라이언트
'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
