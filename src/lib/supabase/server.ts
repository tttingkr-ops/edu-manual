// Created: 2026-01-27 16:30:00
// 서버 컴포넌트용 Supabase 클라이언트
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { MOCK_MODE, mockUsers, mockPosts, mockTestResults, mockReadStatus, mockTestQuestions, mockAuthUser, mockCurrentUser } from '@/lib/mock-data'

// Mock Supabase 클라이언트 생성
function createMockClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: mockAuthUser },
        error: null,
      }),
    },
    from: (table: string) => createMockQueryBuilder(table),
  }
}

// Mock 쿼리 빌더
function createMockQueryBuilder(table: string) {
  let data: any[] = []
  let filters: any = {}
  let orderField: string | null = null
  let orderAsc = true
  let limitCount: number | null = null
  let selectFields = '*'
  let countOnly = false
  let headOnly = false

  switch (table) {
    case 'users':
      data = [...mockUsers]
      break
    case 'educational_posts':
      data = [...mockPosts]
      break
    case 'test_results':
      data = [...mockTestResults]
      break
    case 'read_status':
      data = [...mockReadStatus]
      break
    case 'test_questions':
      data = [...mockTestQuestions]
      break
    default:
      data = []
  }

  const builder = {
    select: (fields: string, options?: { count?: string; head?: boolean }) => {
      selectFields = fields
      if (options?.count === 'exact') countOnly = true
      if (options?.head) headOnly = true
      return builder
    },
    eq: (field: string, value: any) => {
      filters[field] = value
      return builder
    },
    order: (field: string, options?: { ascending?: boolean }) => {
      orderField = field
      orderAsc = options?.ascending ?? true
      return builder
    },
    limit: (count: number) => {
      limitCount = count
      return builder
    },
    single: () => {
      const result = applyFilters()
      return Promise.resolve({
        data: result[0] || null,
        error: null,
      })
    },
    then: (resolve: any) => {
      const result = applyFilters()
      if (headOnly && countOnly) {
        resolve({ count: result.length, error: null })
      } else {
        resolve({ data: result, error: null })
      }
    },
  }

  function applyFilters() {
    let result = [...data]

    // 필터 적용
    Object.entries(filters).forEach(([field, value]) => {
      result = result.filter((item: any) => item[field] === value)
    })

    // 정렬 적용
    if (orderField) {
      result.sort((a: any, b: any) => {
        const aVal = a[orderField!]
        const bVal = b[orderField!]
        if (orderAsc) {
          return aVal > bVal ? 1 : -1
        }
        return aVal < bVal ? 1 : -1
      })
    }

    // 제한 적용
    if (limitCount) {
      result = result.slice(0, limitCount)
    }

    return result
  }

  return builder
}

export async function createClient() {
  // Mock 모드일 때는 Mock 클라이언트 반환
  if (MOCK_MODE) {
    return createMockClient() as any
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // 서버 컴포넌트에서 쿠키 설정 시 에러 무시
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // 서버 컴포넌트에서 쿠키 삭제 시 에러 무시
          }
        },
      },
    }
  )
}

// Mock 모드 여부 export
export { MOCK_MODE }
