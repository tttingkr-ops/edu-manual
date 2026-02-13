// Created: 2026-02-01 20:50:00
// 관리자 주관식 답변 검토 페이지
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ReviewClient from './ReviewClient'

// Admin client for bypassing RLS
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function ReviewsPage() {
  const supabase = await createServerClient()

  // 현재 사용자 확인
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminClient = getAdminClient()
  if (!adminClient) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">서버 설정 오류입니다.</p>
        </div>
      </div>
    )
  }

  // 관리자 권한 확인
  const { data: userData } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    redirect('/manager')
  }

  // 주관식 답변 목록 조회 (pending 또는 ai_graded 상태)
  const { data: answers, error } = await adminClient
    .from('subjective_answers')
    .select(`
      *,
      test_questions (
        id,
        question,
        max_score,
        grading_criteria,
        model_answer,
        category
      ),
      users!subjective_answers_user_id_fkey (
        id,
        username
      )
    `)
    .in('status', ['pending', 'ai_graded'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching answers:', error)
  }

  // 통계 계산
  const totalPending = answers?.filter(a => a.status === 'pending').length || 0
  const totalAiGraded = answers?.filter(a => a.status === 'ai_graded').length || 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-primary-600">
            대시보드
          </Link>
          <span>/</span>
          <span>주관식 답변 검토</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">주관식 답변 검토</h1>
        <p className="mt-1 text-gray-600">
          AI가 채점한 주관식 답변을 검토하고 최종 점수를 확정합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">검토 대기</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">AI 채점 완료</p>
              <p className="text-2xl font-bold text-gray-900">{totalAiGraded}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">총 검토 필요</p>
              <p className="text-2xl font-bold text-gray-900">{(answers?.length || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 답변 목록 */}
      {answers && answers.length > 0 ? (
        <ReviewClient answers={answers} adminId={user.id} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            검토할 답변이 없습니다
          </h2>
          <p className="text-gray-600">
            모든 주관식 답변이 검토 완료되었습니다.
          </p>
        </div>
      )}
    </div>
  )
}
