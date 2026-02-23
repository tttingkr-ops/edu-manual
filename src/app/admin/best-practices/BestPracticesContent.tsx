// Created: 2026-02-23 00:00:00
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Post {
  id: string
  title: string
  content: string
  situation_tag: string | null
  targeting_type: 'group' | 'individual'
  created_at: string
  targetGroups: string[]
  targetUsers: { id: string; username: string; nickname: string | null }[]
  unreadCount: number
  unreadManagers: { id: string; username: string }[]
}

interface Group {
  id: string
  name: string
}

interface BestPracticesContentProps {
  posts: Post[]
  groups: Group[]
}

export default function BestPracticesContent({ posts: initialPosts, groups }: BestPracticesContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [activeGroup, setActiveGroup] = useState<string | null>(
    groups.length > 0 ? groups[0].name : null
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showUnreadModal, setShowUnreadModal] = useState(false)
  const [selectedPostTitle, setSelectedPostTitle] = useState('')
  const [selectedUnreadManagers, setSelectedUnreadManagers] = useState<{ id: string; username: string }[]>([])

  // 현재 탭 게시물 필터링
  const filteredPosts = posts.filter(post => {
    const matchesGroup =
      activeGroup === '개인_피드백'
        ? post.targeting_type === 'individual'
        : activeGroup
          ? post.targetGroups.includes(activeGroup)
          : true
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesGroup && matchesSearch
  })

  const getGroupCount = (groupName: string) => {
    if (groupName === '개인_피드백') return posts.filter(p => p.targeting_type === 'individual').length
    return posts.filter(p => p.targetGroups.includes(groupName)).length
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    setIsLoading(true)
    try {
      await supabase.from('best_practice_groups').delete().eq('post_id', postId)
      await supabase.from('best_practice_target_users').delete().eq('post_id', postId)
      await supabase.from('best_practice_read_status').delete().eq('post_id', postId)
      const { error } = await supabase.from('best_practice_posts').delete().eq('id', postId)
      if (error) throw error
      setPosts(posts.filter(p => p.id !== postId))
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const openUnreadModal = (post: Post) => {
    setSelectedPostTitle(post.title)
    setSelectedUnreadManagers(post.unreadManagers)
    setShowUnreadModal(true)
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

  const tabs = [
    ...groups.map(g => ({ name: g.name, label: g.name })),
    { name: '개인_피드백', label: '개인 피드백' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-primary-600">대시보드</Link>
            <span>/</span>
            <span>모범사례 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">모범사례 관리</h1>
        </div>
        <Link
          href="/admin/best-practices/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 모범사례
        </Link>
      </div>

      {/* 그룹 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveGroup(tab.name)}
              className={`flex-shrink-0 px-6 py-4 text-center border-b-2 transition-colors ${
                activeGroup === tab.name
                  ? 'border-amber-500 text-amber-700 bg-gray-50 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm whitespace-nowrap">{tab.label}</div>
              <div className={`text-2xl font-bold ${activeGroup === tab.name ? 'text-amber-600' : 'text-gray-400'}`}>
                {getGroupCount(tab.name)}
              </div>
            </button>
          ))}
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
            placeholder="제목으로 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* 게시물 목록 */}
      {filteredPosts.length > 0 ? (
        <div className="space-y-3">
          {filteredPosts.map((post, index) => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-medium text-amber-700">
                  {index + 1}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.situation_tag && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                        {post.situation_tag}
                      </span>
                    )}
                    <Link
                      href={`/manager/best-practices/${post.id}`}
                      className="font-medium text-gray-900 truncate hover:text-primary-600 transition-colors"
                    >
                      {post.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 flex-wrap">
                    <span>{formatDate(post.created_at)}</span>
                    {post.targeting_type === 'group' && post.targetGroups.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {post.targetGroups.join(' · ')}
                      </span>
                    )}
                    {post.targeting_type === 'individual' && post.targetUsers.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {post.targetUsers.slice(0, 3).map(u => u.nickname || u.username).join(' · ')}
                        {post.targetUsers.length > 3 && ` +${post.targetUsers.length - 3}명`}
                      </span>
                    )}
                  </div>
                </div>

                {/* 미확인 */}
                <div>
                  {post.unreadCount > 0 ? (
                    <button
                      onClick={() => openUnreadModal(post)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-600 rounded-full hover:bg-red-100"
                    >
                      <span className="font-medium">{post.unreadCount}</span>
                      <span>명 미확인</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      전원 확인
                    </span>
                  )}
                </div>

                {/* 액션 */}
                <div className="flex items-center gap-1">
                  <a
                    href={`/manager/best-practices/${post.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="미리보기"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>
                  <Link
                    href={`/admin/best-practices/${post.id}/edit`}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                    title="수정"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={isLoading}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    title="삭제"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">
            {searchTerm ? '검색 결과가 없습니다.' : '등록된 모범사례가 없습니다.'}
          </p>
          <Link
            href="/admin/best-practices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            첫 모범사례 등록
          </Link>
        </div>
      )}

      {/* 미확인 모달 */}
      {showUnreadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold">미확인 매니저</h2>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{selectedPostTitle}</p>
              </div>
              <button onClick={() => setShowUnreadModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ul className="space-y-2">
                {selectedUnreadManagers.map(m => (
                  <li key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                      {m.username.charAt(0)}
                    </div>
                    <span className="text-gray-900">{m.username}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-xl">
              <button onClick={() => setShowUnreadModal(false)} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
