// Created: 2026-02-23 00:00:00
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  situation_tag: string | null
  targeting_type: 'group' | 'individual'
  created_at: string
  targetGroups: string[]
  isRead: boolean
}

interface Group {
  id: string
  name: string
}

interface Props {
  posts: Post[]
  groups: Group[]
  userGroupNames: string[]
}

export default function ManagerBestPracticesContent({ posts, groups, userGroupNames }: Props) {
  // 내가 속한 그룹만 탭에 표시 (개인 피드백 포함)
  const hasIndividual = posts.some(p => p.targeting_type === 'individual')
  const myGroupNames = groups.filter(g => userGroupNames.includes(g.name)).map(g => g.name)
  const tabs = [
    ...myGroupNames.map(name => ({ name, label: name })),
    ...(hasIndividual ? [{ name: '개인_피드백', label: '개인 피드백' }] : []),
  ]

  const [activeTab, setActiveTab] = useState<string>(tabs.length > 0 ? tabs[0].name : '')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredPosts = posts.filter(post => {
    const matchesTab =
      activeTab === '개인_피드백'
        ? post.targeting_type === 'individual'
        : post.targetGroups.includes(activeTab)
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.situation_tag?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    return matchesTab && matchesSearch
  })

  const getTabCount = (tabName: string) => {
    if (tabName === '개인_피드백') return posts.filter(p => p.targeting_type === 'individual').length
    return posts.filter(p => p.targetGroups.includes(tabName)).length
  }

  const getUnreadCount = (tabName: string) => {
    if (tabName === '개인_피드백')
      return posts.filter(p => p.targeting_type === 'individual' && !p.isRead).length
    return posts.filter(p => p.targetGroups.includes(tabName) && !p.isRead).length
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">모범사례</h1>
        <p className="mt-1 text-sm text-gray-500">우수한 응대 사례를 확인하고 학습하세요.</p>
      </div>

      {tabs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-gray-500">아직 등록된 모범사례가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 탭 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => {
                const unread = getUnreadCount(tab.name)
                return (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab.name)}
                    className={`flex-shrink-0 px-6 py-4 text-center border-b-2 transition-colors ${
                      activeTab === tab.name
                        ? 'border-amber-500 text-amber-700 bg-gray-50 font-semibold'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-sm">{tab.label}</span>
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold bg-red-500 text-white rounded-full">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className={`text-2xl font-bold ${activeTab === tab.name ? 'text-amber-600' : 'text-gray-400'}`}>
                      {getTabCount(tab.name)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 검색 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="relative max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="제목 또는 상황 태그 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* 게시물 목록 */}
          {filteredPosts.length > 0 ? (
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <Link
                  key={post.id}
                  href={`/manager/best-practices/${post.id}`}
                  className="block bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {/* 읽음 상태 인디케이터 */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${post.isRead ? 'bg-gray-200' : 'bg-amber-500'}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.situation_tag && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            {post.situation_tag}
                          </span>
                        )}
                        <span className={`font-medium truncate ${post.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                          {post.title}
                        </span>
                        {!post.isRead && (
                          <span className="flex-shrink-0 px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-medium rounded-full border border-amber-200">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        {formatDate(post.created_at)}
                      </div>
                    </div>

                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">
                {searchTerm ? '검색 결과가 없습니다.' : '이 탭에 등록된 모범사례가 없습니다.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
