// Created: 2026-01-27 17:15:00
// Updated: 2026-01-30 - 카테고리 탭 UI, 노션 가져오기 기능 추가
// Updated: 2026-02-06 - 서브카테고리(유형) 관리 UI 추가
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ContentType = 'video' | 'document'
type Category = '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙'

interface UnreadManager {
  id: string
  name: string
}

interface Post {
  id: string
  title: string
  content_type: ContentType
  content: string
  category: Category
  sub_category: string | null
  created_at: string
  updated_at: string
  author_id: string
  unreadCount: number
  unreadManagers: UnreadManager[]
}

interface SubCategory {
  id: string
  category: string
  name: string
  sort_order: number
}

interface PostsContentProps {
  posts: Post[]
}

const CATEGORIES: { value: Category; label: string; color: string; bgColor: string }[] = [
  { value: '남자_매니저_대화', label: '남자 매니저 대화', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  { value: '여자_매니저_대화', label: '여자 매니저 대화', color: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-200' },
  { value: '여자_매니저_소개', label: '여자 매니저 소개', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  { value: '추가_서비스_규칙', label: '추가 서비스 규칙', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
]

export default function PostsContent({ posts: initialPosts }: PostsContentProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0].value)
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showUnreadModal, setShowUnreadModal] = useState(false)
  const [selectedPostTitle, setSelectedPostTitle] = useState('')
  const [selectedUnreadManagers, setSelectedUnreadManagers] = useState<UnreadManager[]>([])
  const [showNotionModal, setShowNotionModal] = useState(false)
  const [notionUrl, setNotionUrl] = useState('')
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionError, setNotionError] = useState<string | null>(null)

  // 서브카테고리 상태
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')

  const supabase = createClient()

  // 서브카테고리 목록 조회
  useEffect(() => {
    const fetchSubCategories = async () => {
      const { data } = await supabase
        .from('sub_categories')
        .select('*')
        .order('sort_order')
        .order('name')
      setSubCategories(data || [])
    }
    fetchSubCategories()
  }, [])

  // 카테고리 변경 시 서브카테고리 필터 초기화
  useEffect(() => {
    setActiveSubCategory(null)
  }, [activeCategory])

  // 현재 카테고리의 서브카테고리
  const currentSubCategories = subCategories.filter(sc => sc.category === activeCategory)

  // 현재 카테고리의 게시물
  const categoryPosts = posts.filter((post) => {
    const matchesCategory = post.category === activeCategory
    const matchesSubCategory = activeSubCategory === null || post.sub_category === activeSubCategory
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSubCategory && matchesSearch
  })

  // 카테고리별 게시물 수
  const getCategoryCount = (category: Category) => {
    return posts.filter((p) => p.category === category).length
  }

  // 서브카테고리 추가
  const handleAddSubCategory = async () => {
    const name = newSubCategoryName.trim()
    if (!name) return

    try {
      const { data, error } = await supabase
        .from('sub_categories')
        .insert({
          category: activeCategory,
          name,
          sort_order: currentSubCategories.length,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          alert('이미 존재하는 유형입니다.')
        } else {
          throw error
        }
        return
      }

      setSubCategories([...subCategories, data])
      setNewSubCategoryName('')
      setIsAddingSubCategory(false)
    } catch (err: any) {
      console.error('Error adding sub_category:', err)
      alert(err.message || '유형 추가 중 오류가 발생했습니다.')
    }
  }

  // 서브카테고리 삭제
  const handleDeleteSubCategory = async (subCat: SubCategory) => {
    if (!confirm(`"${subCat.name}" 유형을 삭제하시겠습니까?\n이 유형에 속한 게시물의 유형 정보가 비워집니다.`)) return

    try {
      // 서브카테고리 삭제
      const { error } = await supabase
        .from('sub_categories')
        .delete()
        .eq('id', subCat.id)

      if (error) throw error

      // 해당 서브카테고리가 지정된 게시물의 sub_category를 null로
      await supabase
        .from('educational_posts')
        .update({ sub_category: null })
        .eq('category', subCat.category as Category)
        .eq('sub_category', subCat.name)

      setSubCategories(subCategories.filter(sc => sc.id !== subCat.id))
      if (activeSubCategory === subCat.name) {
        setActiveSubCategory(null)
      }

      // 게시물 목록도 업데이트
      setPosts(posts.map(p =>
        p.category === subCat.category && p.sub_category === subCat.name
          ? { ...p, sub_category: null }
          : p
      ))
    } catch (err: any) {
      console.error('Error deleting sub_category:', err)
      alert(err.message || '유형 삭제 중 오류가 발생했습니다.')
    }
  }

  // 미확인 매니저 모달 열기
  const openUnreadModal = (post: Post) => {
    setSelectedPostTitle(post.title)
    setSelectedUnreadManagers(post.unreadManagers)
    setShowUnreadModal(true)
  }

  // 삭제
  const handleDelete = async (postId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    setIsLoading(true)
    try {
      await supabase.from('post_groups').delete().eq('post_id', postId)
      const { error: deleteError } = await supabase
        .from('educational_posts')
        .delete()
        .eq('id', postId)

      if (deleteError) throw deleteError
      setPosts(posts.filter((p) => p.id !== postId))
    } catch (err: any) {
      console.error('Error deleting post:', err)
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 노션 가져오기
  const handleNotionImport = async () => {
    if (!notionUrl.trim()) {
      setNotionError('노션 URL을 입력해주세요.')
      return
    }

    setNotionLoading(true)
    setNotionError(null)

    try {
      const response = await fetch('/api/notion/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: notionUrl,
          category: activeCategory
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '가져오기에 실패했습니다.')
      }

      alert(`"${result.title}" 게시물이 생성되었습니다.`)
      setShowNotionModal(false)
      setNotionUrl('')
      router.refresh()
    } catch (err: any) {
      console.error('Notion import error:', err)
      setNotionError(err.message)
    } finally {
      setNotionLoading(false)
    }
  }

  // 콘텐츠 타입 아이콘
  const getContentTypeIcon = (type: ContentType) => {
    if (type === 'video') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const activeCategoryInfo = CATEGORIES.find(c => c.value === activeCategory)!

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-primary-600">대시보드</Link>
            <span>/</span>
            <span>교육 게시물 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">교육 게시물 관리</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNotionModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.493-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.454-.234 4.763 7.279v-6.44l-1.214-.14c-.093-.514.28-.886.746-.933l3.221-.187zM2.778.652L16.082 0c1.635-.14 2.055.14 2.708.606l4.204 2.896c.42.327.56.607.56 1.073v17.087c0 .933-.327 1.493-1.493 1.586l-15.458.934c-.886.046-1.307-.094-1.773-.654L.917 21.67c-.514-.653-.7-1.073-.7-1.726V2.085c0-.84.327-1.4 1.26-1.493l1.3-.046z"/>
            </svg>
            노션에서 가져오기
          </button>
          <Link
            href={`/admin/posts/new?category=${activeCategory}`}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 교육 자료
          </Link>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex-1 min-w-[150px] px-6 py-4 text-center border-b-2 transition-colors ${
                activeCategory === cat.value
                  ? `border-current ${cat.color} bg-gray-50 font-semibold`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm">{cat.label}</div>
              <div className={`text-2xl font-bold ${activeCategory === cat.value ? cat.color : 'text-gray-400'}`}>
                {getCategoryCount(cat.value)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 현재 카테고리 헤더 */}
      <div className={`rounded-xl border p-4 mb-6 ${activeCategoryInfo.bgColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${activeCategoryInfo.color} bg-white flex items-center justify-center`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${activeCategoryInfo.color}`}>{activeCategoryInfo.label}</h2>
              <p className="text-sm text-gray-600">{getCategoryCount(activeCategory)}개의 교육 자료</p>
            </div>
          </div>
          {/* 검색 */}
          <div className="relative w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="제목으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* 서브카테고리 (유형) 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-600 mr-1">유형:</span>
          <button
            onClick={() => setActiveSubCategory(null)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activeSubCategory === null
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          {currentSubCategories.map((sc) => (
            <div key={sc.id} className="flex items-center gap-0.5">
              <button
                onClick={() => setActiveSubCategory(activeSubCategory === sc.name ? null : sc.name)}
                className={`px-3 py-1.5 text-sm rounded-l-full border transition-colors ${
                  activeSubCategory === sc.name
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {sc.name}
                <span className="ml-1 text-xs opacity-70">
                  ({posts.filter(p => p.category === activeCategory && p.sub_category === sc.name).length})
                </span>
              </button>
              <button
                onClick={() => handleDeleteSubCategory(sc)}
                className={`px-1.5 py-1.5 text-sm rounded-r-full border border-l-0 transition-colors ${
                  activeSubCategory === sc.name
                    ? 'bg-primary-700 text-white border-primary-600 hover:bg-primary-800'
                    : 'bg-white text-gray-400 border-gray-300 hover:text-red-500 hover:bg-red-50'
                }`}
                title="유형 삭제"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {isAddingSubCategory ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newSubCategoryName}
                onChange={(e) => setNewSubCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubCategory()
                  if (e.key === 'Escape') { setIsAddingSubCategory(false); setNewSubCategoryName('') }
                }}
                placeholder="유형 이름"
                className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
              <button
                onClick={handleAddSubCategory}
                className="px-2 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                추가
              </button>
              <button
                onClick={() => { setIsAddingSubCategory(false); setNewSubCategoryName('') }}
                className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingSubCategory(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 border border-dashed border-primary-300 rounded-full hover:bg-primary-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              유형 추가
            </button>
          )}
        </div>
      </div>

      {/* 게시물 목록 */}
      {categoryPosts.length > 0 ? (
        <div className="space-y-3">
          {categoryPosts.map((post, index) => (
            <div
              key={post.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                {/* 순번 */}
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                  {index + 1}
                </div>

                {/* 타입 아이콘 */}
                <div className={`p-2 rounded-lg ${post.content_type === 'video' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  {getContentTypeIcon(post.content_type)}
                </div>

                {/* 제목 & 정보 */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/manager/education/${post.id}`}
                    className="font-medium text-gray-900 truncate block hover:text-primary-600 transition-colors"
                  >
                    {post.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span>{formatDate(post.created_at)}</span>
                    <span>{post.content_type === 'video' ? '동영상' : '문서'}</span>
                    {post.sub_category && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {post.sub_category}
                      </span>
                    )}
                  </div>
                </div>

                {/* 미확인 상태 */}
                <div className="flex items-center gap-2">
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

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1">
                  <Link
                    href={`/manager/education/${post.id}`}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="미리보기"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </Link>
                  <Link
                    href={`/admin/posts/${post.id}/edit`}
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
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 mb-4">
            {searchTerm ? '검색 결과가 없습니다.' : activeSubCategory ? `"${activeSubCategory}" 유형에 등록된 교육 자료가 없습니다.` : `${activeCategoryInfo.label} 카테고리에 등록된 교육 자료가 없습니다.`}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowNotionModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.493-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.454-.234 4.763 7.279v-6.44l-1.214-.14c-.093-.514.28-.886.746-.933l3.221-.187zM2.778.652L16.082 0c1.635-.14 2.055.14 2.708.606l4.204 2.896c.42.327.56.607.56 1.073v17.087c0 .933-.327 1.493-1.493 1.586l-15.458.934c-.886.046-1.307-.094-1.773-.654L.917 21.67c-.514-.653-.7-1.073-.7-1.726V2.085c0-.84.327-1.4 1.26-1.493l1.3-.046z"/>
              </svg>
              노션에서 가져오기
            </button>
            <Link
              href={`/admin/posts/new?category=${activeCategory}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              직접 작성하기
            </Link>
          </div>
        </div>
      )}

      {/* 미확인 매니저 모달 */}
      {showUnreadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">미확인 매니저</h2>
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
                {selectedUnreadManagers.map((manager) => (
                  <li key={manager.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                      {manager.name.charAt(0)}
                    </div>
                    <span className="text-gray-900">{manager.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
              <button onClick={() => setShowUnreadModal(false)} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 노션 가져오기 모달 */}
      {showNotionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.493-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.454-.234 4.763 7.279v-6.44l-1.214-.14c-.093-.514.28-.886.746-.933l3.221-.187zM2.778.652L16.082 0c1.635-.14 2.055.14 2.708.606l4.204 2.896c.42.327.56.607.56 1.073v17.087c0 .933-.327 1.493-1.493 1.586l-15.458.934c-.886.046-1.307-.094-1.773-.654L.917 21.67c-.514-.653-.7-1.073-.7-1.726V2.085c0-.84.327-1.4 1.26-1.493l1.3-.046z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">노션에서 가져오기</h2>
                  <p className="text-sm text-gray-500">{activeCategoryInfo.label} 카테고리로 추가됩니다</p>
                </div>
              </div>
              <button onClick={() => { setShowNotionModal(false); setNotionError(null); setNotionUrl(''); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  노션 페이지 URL
                </label>
                <input
                  type="url"
                  value={notionUrl}
                  onChange={(e) => setNotionUrl(e.target.value)}
                  placeholder="https://www.notion.so/..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  노션 페이지를 공유하고 URL을 붙여넣으세요. 페이지가 공개 상태여야 합니다.
                </p>
              </div>

              {notionError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{notionError}</p>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">지원하는 콘텐츠</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>- 텍스트, 제목, 목록</li>
                  <li>- 이미지 (외부 링크)</li>
                  <li>- YouTube/Vimeo 영상</li>
                  <li>- 테이블, 인용문</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex gap-3">
              <button
                onClick={() => { setShowNotionModal(false); setNotionError(null); setNotionUrl(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleNotionImport}
                disabled={notionLoading || !notionUrl.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {notionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    가져오는 중...
                  </span>
                ) : '가져오기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
