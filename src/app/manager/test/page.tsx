// Created: 2026-01-27 17:30:00
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const CATEGORIES = [
  {
    id: '남자_매니저_대화',
    title: '남자 매니저 대화',
    description: '남자 매니저를 위한 고객 응대 및 대화 스킬 테스트',
    icon: '👨‍💼',
    color: 'bg-blue-500',
    questions: 5,
  },
  {
    id: '여자_매니저_대화',
    title: '여자 매니저 대화',
    description: '여자 매니저를 위한 고객 응대 및 대화 스킬 테스트',
    icon: '👩‍💼',
    color: 'bg-pink-500',
    questions: 5,
  },
  {
    id: '여자_매니저_소개',
    title: '여자 매니저 소개',
    description: '효과적인 자기소개 방법 및 첫인상 관리 테스트',
    icon: '🎤',
    color: 'bg-purple-500',
    questions: 5,
  },
  {
    id: '추가_서비스_규칙',
    title: '추가 서비스 규칙',
    description: '추가 서비스 제공 시 준수해야 할 규칙 테스트',
    icon: '📋',
    color: 'bg-orange-500',
    questions: 5,
  },
]

export default async function TestListPage() {
  const supabase = await createClient()

  // 현재 사용자 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 사용자의 최근 테스트 결과 조회
  const { data: recentResults } = await supabase
    .from('test_results')
    .select('*')
    .eq('user_id', user?.id || '')
    .order('test_date', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">테스트</h1>
        <p className="mt-2 text-gray-600">
          교육 내용을 얼마나 이해했는지 테스트해보세요.
        </p>
      </div>

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
            <span className="bg-white/20 px-3 py-1 rounded-full">20문제</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">전 카테고리</span>
          </div>
        </Link>
      </div>

      {/* 카테고리별 테스트 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 테스트</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map((category) => (
            <Link
              key={category.id}
              href={`/manager/test/${encodeURIComponent(category.id)}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center text-2xl`}
                >
                  {category.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{category.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {category.questions}문제
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 테스트 결과 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 테스트 결과</h2>
        {recentResults && recentResults.length > 0 ? (
          <div className="space-y-3">
            {recentResults.map((result: any) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
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
              </div>
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
