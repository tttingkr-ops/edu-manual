// Created: 2026-02-13 12:00:00
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '아이디를 입력해주세요.' }, { status: 400 })
    }

    const trimmed = username.trim()

    // @ 포함이면 이메일 그대로 반환
    if (trimmed.includes('@')) {
      return NextResponse.json({ email: trimmed })
    }

    // ASCII만이면 바로 @ttting.com 변환
    const isAscii = /^[\x00-\x7F]+$/.test(trimmed)
    if (isAscii) {
      return NextResponse.json({ email: `${trimmed}@ttting.com` })
    }

    // 한글 등 비ASCII: users 테이블에서 username으로 조회 → auth email 찾기
    const supabase = createAdminClient()

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmed)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: '등록되지 않은 아이디입니다.' }, { status: 404 })
    }

    // admin client로 auth.users에서 이메일 조회
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userData.id)

    if (authError || !authData?.user?.email) {
      return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ email: authData.user.email })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
