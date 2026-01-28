// Created: 2026-01-27 16:30:00
// 미들웨어용 Supabase 클라이언트
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { mockAuthUser, mockCurrentUser } from '@/lib/mock-data'

const MOCK_MODE =
  process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL

// Mock Supabase 클라이언트 (미들웨어용)
function createMockMiddlewareClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: mockAuthUser },
        error: null,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: mockCurrentUser,
              error: null,
            }),
        }),
      }),
    }),
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Mock 모드일 때는 Mock 클라이언트 사용
  if (MOCK_MODE) {
    const mockSupabase = createMockMiddlewareClient()
    const {
      data: { user },
    } = await mockSupabase.auth.getUser()
    return { response, user, supabase: mockSupabase as any }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 세션 갱신
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user, supabase }
}
