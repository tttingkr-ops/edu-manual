// Created: 2026-01-27 17:30:00
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  {
    id: '남자_매니저_대화',
    title: '남자 매니저 대화',
    description: '남자 매니저를 위한 고객 응대 및 대화 스킬 테스트',
    icon: '👨‍💼',
    color: 'bg-blue-500',
  },
  {
    id: '여자_매니저_대화',
    title: '여자 매니저 대화',
    description: '여자 매니저를 위한 고객 응대 및 대화 스킬 테스트',
    icon: '👩‍💼',
    color: 'bg-pink-500',
  },
  {
    id: '여자_매니저_소개',
    title: '여자 매니저 소개',
    description: '효과적인 자기소개 방법 및 첫인상 관리 테스트',
    icon: '🎤',
    color: 'bg-purple-500',
  },
  {
    id: '추가_서비스_규칙',
    title: '공지사항',
    description: '추가 서비스 제공 시 준수해야 할 규칙 테스트',
    icon: '📋',
    color: 'bg-orange-500',
  },
  {
    id: '개인_피드백',
    title: '개인 피드백',
    description: '개인별 피드백 및 맞춤형 교육 테스트',
    icon: '💬',
    color: 'bg-teal-500',
  },
]

export default async function TestListPage() {
  const supabase = await createClient()

  // 현재 사용자 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 사용자 그룹 조회
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select('group_id, groups(name)')
    .eq('user_id', user?.id || '')

  // 허용 카테고리 계산 (그룹명의 공백을 언더스코어로 변환)
  const userGroupNames = (userGroups || []).map((ug: any) => ug.groups?.name).filter(Boolean)
  const allowedCategories = userGroupNames.length > 0
    ? userGroupNames.map((name: string) => name.replace(/ /g, '_'))
    : null // null = 모든 카테고리

  // 허용된 카테고리만 필터
  const filteredCategories = allowedCategories
    ? CATEGORIES.filter(c => allowedCategories.includes(c.id))
    : CATEGORIES

  // 모든 테스트 문제 조회하여 카테고리별 개수 계산
  const { data: allQuestions } = await supabase
    .from('test_questions')
    .select('category')

  const countByCategory: Record<string, number> = {}
  allQuestions?.forEach((q: any) => {
    countByCategory[q.category] = (countByCategory[q.category] || 0) + 1
  })

  // 전체 문제 수: 허용 카테고리의 문제만 카운트
  const allowedCategoryIds = filteredCategories.map(c => c.id)
  const totalQuestions = allQuestions?.filter((q: any) => allowedCategoryIds.includes(q.category)).length || 0

  // 사용자의 최근 테스트 결과 조회
  const { data: recentResults } = await supabase
    .from('test_results')
    .select('*')
    .eq('user_id', user?.id || '')
    .order('test_date', { ascending: false })
    .limit(5)

  // 나에게 타겟된 게시물의 테스트 문제 조회 (Feature 4)
  const { data: targetedPosts } = await supabase
    .from('post_target_users')
    .select('post_id, educational_posts(id, title, test_visibility, category)')
    .eq('user_id', user?.id || '')

  const targetedQuestionCount = await (async () => {
    const targetedPostIds = (targetedPosts || [])
      .filter((tp: any) => tp.educational_posts?.test_visibility === 'targeted')
      .map((tp: any) => tp.post_id)
    if (targetedPostIds.length === 0) return 0
    const { count } = await supabase
      .from('test_questions')
      .select('id', { count: 'exact', head: true })
      .in('related_post_id', targetedPostIds)
    return count || 0
  })()

  // 할당된 재테스트 조회 (Feature 3)
  const { data: retestAssignments } = await supabase
    .from('retest_assignments')
    .select('*')
    .eq('manager_id', user?.id || '')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // 최근 테스트 오답 여부 확인 (Feature 1) - 가장 최근 결과에서 오답이 있는지
  const latestResult = recentResults?.[0]
  const hasWrongAnswers = latestResult && latestResult.correct_count < latestResult.total_count

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">테스트</h1>
        <p className="mt-2 text-gray-600">
          교육 내용을 얼마나 이해했는지 테스트해보세요.
        </p>
      </div>

      {/* 할당된 재테스트 (Feature 3) */}
      {retestAssignments && retestAssignments.length > 0 && (
        <div className="mb-8 bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-red-800">할당된 재테스트</h2>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {retestAssignments.length}
            </span>
          </div>
          <div className="space-y-3">
            {retestAssignments.map((assignment: any) => (
              <Link
                key={assignment.id}
                href={`/manager/test/${encodeURIComponent(assignment.category || '전체')}?retestId=${assignment.id}`}
                className="block p-4 bg-white rounded-lg border border-red-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {assignment.category ? assignment.category.replace(/_/g, ' ') : '전체'} 재테스트
                    </p>
                    {assignment.reason && (
                      <p className="text-sm text-gray-500 mt-1">사유: {assignment.reason}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(assignment.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 나에게 할당된 문제 (Feature 4) */}
      {targetedQuestionCount > 0 && (
        <div className="mb-8">
          <Link
            href="/manager/test/내_할당_문제"
            className="block bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-6 text-white hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">나에게 할당된 문제</h2>
                <p className="text-teal-100">
                  개인 피드백으로 할당된 문제를 풀어보세요.
                </p>
              </div>
              <div className="text-4xl">🎯</div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="bg-white/20 px-3 py-1 rounded-full">
                {targetedQuestionCount}문제
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* 오답 복습 바로가기 (Feature 1) */}
      {hasWrongAnswers && latestResult && (
        <div className="mb-8">
          <Link
            href={`/manager/test/review?resultId=${latestResult.id}`}
            className="block bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-6 text-white hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">오답 복습</h2>
                <p className="text-amber-100">
                  최근 테스트에서 틀린 문제를 다시 풀어보세요.
                </p>
              </div>
              <div className="text-4xl">📖</div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="bg-white/20 px-3 py-1 rounded-full">
                {latestResult.total_count - latestResult.correct_count}문제 오답
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full">
                {latestResult.category === '전체' ? '전체 테스트' : latestResult.category.replace(/_/g, ' ')}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* 전체 테스트 */}
      <div className="mb-8">
        <Link
          href="/manager/test/전체"
          className="block bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">전체 테스트</h2>
              <p className="text-primary-100">
                모든 카테고리에서 랜덤으로 20문제가 출제됩니다.
              </p>
            </div>
            <div className="text-4xl">📝</div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full">
              총 {totalQuestions}문제
            </span>
            <span className="bg-white/20 px-3 py-1 rounded-full">전 카테고리</span>
          </div>
        </Link>
      </div>

      {/* 카테고리별 테스트 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 테스트</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map((category) => {
            const questionCount = countByCategory[category.id] || 0
            const hasQuestions = questionCount > 0

            const content = (
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center text-2xl`}
                >
                  {category.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{category.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                  <p className={`text-xs mt-2 ${hasQuestions ? 'text-gray-400' : 'text-red-500'}`}>
                    {hasQuestions ? `${questionCount}문제` : '문제 없음'}
                  </p>
                </div>
              </div>
            )

            return hasQuestions ? (
              <Link
                key={category.id}
                href={`/manager/test/${encodeURIComponent(category.id)}`}
                className="bg-white rounded-xl border border-gray-200 p-5 transition-shadow hover:shadow-md cursor-pointer"
              >
                {content}
              </Link>
            ) : (
              <div
                key={category.id}
                className="bg-white rounded-xl border border-gray-200 p-5 opacity-50 cursor-not-allowed"
              >
                {content}
              </div>
            )
          })}
        </div>
      </div>

      {/* 최근 테스트 결과 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 테스트 결과</h2>
        {recentResults && recentResults.length > 0 ? (
          <div className="space-y-3">
            {recentResults.map((result: any) => (
              <Link
                key={result.id}
                href={`/manager/test/results/${result.id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {result.category === '전체' ? '전체 테스트' : result.category.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(result.test_date).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p
                      className={`text-xl font-bold ${
                        result.score >= 80
                          ? 'text-green-600'
                          : result.score >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {result.score}점
                    </p>
                    <p className="text-xs text-gray-500">
                      {result.correct_count}/{result.total_count} 정답
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>아직 응시한 테스트가 없습니다.</p>
            <p className="text-sm mt-1">위 테스트 중 하나를 선택해서 시작해보세요!</p>
          </div>
        )}
      </div>

    </div>
  )
}
