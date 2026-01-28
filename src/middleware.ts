// Created: 2026-01-27 16:30:00
// Next.js 미들웨어 - 인증 및 라우팅 처리
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request)
  const { pathname } = request.nextUrl

  // 공개 경로 (로그인 필요 없음)
  const publicPaths = ['/login', '/auth/callback']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // 로그인하지 않은 경우
  if (!user) {
    if (isPublicPath) {
      return response
    }
    // 로그인 페이지로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 로그인한 경우
  if (isPublicPath && pathname === '/login') {
    // 사용자 역할 조회
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = userData?.role || 'manager'

    // 역할에 따라 리다이렉트
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    } else {
      return NextResponse.redirect(new URL('/manager/education', request.url))
    }
  }

  // 관리자 페이지 접근 권한 체크
  if (pathname.startsWith('/admin')) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.redirect(new URL('/manager/education', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 경로에서 미들웨어 실행:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico (파비콘)
     * - public 폴더
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
