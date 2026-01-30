// Created: 2026-01-27 16:30:00
// Updated: 2026-01-29 - 매니저별 현황 대시보드 추가
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface ManagerStats {
  id: string
  name: string
  username: string
  averageScore: number | null
  totalTests: number
  unreadCount: number
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 통계 데이터 조회
  const [
    { count: userCount },
    { count: postCount },
    { data: recentTests },
    { data: managers },
    { data: readingProgress },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('educational_posts').select('*', { count: 'exact', head: true }),
    supabase
      .from('test_results')
      .select('*, users(name)')
      .order('test_date', { ascending: false })
      .limit(5),
    supabase
      .from('users')
      .select('id, name, username')
      .eq('role', 'manager'),
    supabase
      .from('user_reading_progress')
      .select('user_id, total_posts, read_posts'),
  ])

  // 매니저별 점수 조회
  const managerStats: ManagerStats[] = await Promise.all(
    (managers || []).map(async (manager) => {
      const { data: scoreData } = await supabase
        .rpc('get_user_average_score', { p_user_id: manager.id })

      const progress = readingProgress?.find(p => p.user_id === manager.id)
      const unreadCount = (progress?.total_posts || 0) - (progress?.read_posts || 0)

      return {
        id: manager.id,
        name: manager.name,
        username: manager.username,
        averageScore: scoreData?.[0]?.average_score ?? null,
        totalTests: scoreData?.[0]?.total_tests ?? 0,
        unreadCount: unreadCount > 0 ? unreadCount : 0,
      }
    })
  )

  const stats = [
    {
      label: '전체 사용자',
      value: userCount || 0,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      href: '/admin/users',
      color: 'bg-blue-500',
    },
    {
      label: '교육 게시물',
      value: postCount || 0,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
      href: '/admin/posts',
      color: 'bg-green-500',
    },
    {
      label: '매니저 수',
      value: managers?.length || 0,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      href: '/admin/users',
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="mt-2 text-gray-600">
          팅팅팅 교육 시스템 관리 현황을 확인하세요.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-white`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 매니저별 현황 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          매니저별 현황
        </h2>
        {managerStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">매니저</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">평균 점수</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">응시 횟수</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">미확인 게시물</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {managerStats.map((manager) => (
                  <tr key={manager.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                          {manager.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{manager.name}</p>
                          <p className="text-sm text-gray-500">{manager.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {manager.averageScore !== null ? (
                        <span className={`font-semibold ${
                          manager.averageScore >= 80 ? 'text-green-600' :
                          manager.averageScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {manager.averageScore}점
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {manager.totalTests}회
                    </td>
                    <td className="py-3 px-4 text-center">
                      {manager.unreadCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {manager.unreadCount}개
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          완료
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            등록된 매니저가 없습니다.
          </p>
        )}
      </div>

      {/* 빠른 작업 & 최근 테스트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 빠른 링크 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 작업</h2>
          <div className="space-y-3">
            <Link
              href="/admin/posts/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="font-medium text-gray-900">새 교육 자료 등록</span>
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              </div>
              <span className="font-medium text-gray-900">사용자 관리</span>
            </Link>
            <Link
              href="/admin/tests"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <span className="font-medium text-gray-900">테스트 문제 관리</span>
            </Link>
          </div>
        </div>

        {/* 최근 테스트 결과 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            최근 테스트 결과
          </h2>
          {recentTests && recentTests.length > 0 ? (
            <div className="space-y-3">
              {recentTests.map((test: any) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {test.users?.name || '알 수 없음'}
                    </p>
                    <p className="text-sm text-gray-500">{test.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      test.score >= 80 ? 'text-green-600' :
                      test.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{test.score}점</p>
                    <p className="text-xs text-gray-500">
                      {test.correct_count}/{test.total_count}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              아직 테스트 결과가 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
