// Created: 2026-01-27 16:30:00
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface HeaderProps {
  userName?: string
  userRole?: 'admin' | 'manager'
}

export default function Header({ userName, userRole }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const managerNavItems = [
    { href: '/manager/education', label: '교육 자료' },
    { href: '/manager/test', label: '테스트' },
    { href: '/manager/my-progress', label: '학습 현황' },
  ]

  const adminNavItems = [
    { href: '/admin', label: '대시보드' },
    { href: '/admin/posts', label: '게시물 관리' },
    { href: '/admin/tests', label: '테스트 관리' },
    { href: '/admin/users', label: '사용자 관리' },
  ]

  const navItems = userRole === 'admin' ? adminNavItems : managerNavItems

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 */}
          <Link
            href={userRole === 'admin' ? '/admin' : '/manager/education'}
            className="flex items-center"
          >
            <span className="text-xl font-bold text-primary-600">팅팅팅</span>
            <span className="ml-2 text-sm text-gray-500">교육 시스템</span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 사용자 정보 & 로그아웃 */}
          <div className="hidden md:flex items-center space-x-4">
            {userName && (
              <span className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{userName}</span>님
                {userRole === 'admin' && (
                  <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                    관리자
                  </span>
                )}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              로그아웃
            </button>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-2" />
              {userName && (
                <div className="px-4 py-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{userName}</span>님
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
