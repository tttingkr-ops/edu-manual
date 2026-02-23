// Created: 2026-02-11 14:35:00
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MarkdownEditor from '@/components/MarkdownEditor'

type PostType = 'free' | 'poll'

interface SubCategory {
  id: string
  name: string
}

export default function NewMeetingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // 닉네임
  const [nicknames, setNicknames] = useState<string[]>([])
  const [selectedNickname, setSelectedNickname] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [postType, setPostType] = useState<PostType>('free')
  const [content, setContent] = useState('')
  const [subCategory, setSubCategory] = useState<string>('')
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])

  // Priority & deadline
  type Priority = 'urgent' | 'high' | 'normal' | 'low' | ''
  const [priority, setPriority] = useState<Priority>('')
  const [deadline, setDeadline] = useState<string>('')

  // Poll-specific state
  const [options, setOptions] = useState<string[]>(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      } else {
        router.push('/login')
      }
    }
    const fetchSubCategories = async () => {
      const { data } = await supabase
        .from('sub_categories')
        .select('id, name')
        .eq('category', 'meeting')
        .order('sort_order')
        .order('name')
      setSubCategories(data || [])
    }
    const fetchNicknames = async () => {
      const { data } = await supabase
        .from('users')
        .select('nickname')
        .not('nickname', 'is', null)
      setNicknames((data || []).map((u: any) => u.nickname).filter(Boolean))
    }
    getUser()
    fetchSubCategories()
    fetchNicknames()
  }, [])

  const addOption = () => {
    setOptions([...options, ''])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }

    if (!userId) {
      setError('로그인이 필요합니다.')
      return
    }

    if (postType === 'free' && !content.trim()) {
      setError('내용을 입력해주세요.')
      return
    }

    if (postType === 'poll') {
      const validOptions = options.filter((opt) => opt.trim())
      if (validOptions.length < 2) {
        setError('투표 항목을 최소 2개 이상 입력해주세요.')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const commonFields = {
        title: title.trim(),
        author_id: userId,
        priority: priority || null,
        deadline: deadline || null,
        sub_category: subCategory || null,
        display_nickname: selectedNickname || null,
      }

      if (postType === 'free') {
        const { error: insertError } = await supabase
          .from('meeting_posts')
          .insert({
            ...commonFields,
            content: content,
            post_type: 'free',
          })

        if (insertError) throw insertError
      } else {
        // Insert poll post
        const { data, error: insertError } = await supabase
          .from('meeting_posts')
          .insert({
            ...commonFields,
            content: content.trim() || null,
            post_type: 'poll',
            is_anonymous: isAnonymous,
            allow_multiple: allowMultiple,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Insert poll options
        const optionInserts = options
          .filter((opt) => opt.trim())
          .map((opt, idx) => ({
            post_id: data.id,
            option_text: opt.trim(),
            sort_order: idx,
          }))

        const { error: optionsError } = await supabase
          .from('meeting_poll_options')
          .insert(optionInserts)

        if (optionsError) throw optionsError
      }

      router.push('/meetings')
      router.refresh()
    } catch (err: any) {
      console.error('Error creating meeting post:', err)
      setError(err.message || '안건 등록 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/meetings" className="hover:text-primary-600">
          회의 안건방
        </Link>
        <span>/</span>
        <span>새 안건 작성</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">새 안건 작성</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 작성자 닉네임 */}
        {nicknames.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              작성자 표시 <span className="text-gray-400 text-xs font-normal">(선택사항)</span>
            </label>
            <select
              value={selectedNickname}
              onChange={e => setSelectedNickname(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">선택 안 함 (기본 닉네임 표시)</option>
              {nicknames.map(nick => (
                <option key={nick} value={nick}>{nick}</option>
              ))}
            </select>
          </div>
        )}

        {/* 제목 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="안건 제목을 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* 유형 */}
        {subCategories.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              유형 <span className="text-gray-400 text-xs font-normal">(선택사항)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubCategory('')}
                className={`px-3 py-1.5 text-sm rounded-full border-2 transition-all ${
                  subCategory === ''
                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-400'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                없음
              </button>
              {subCategories.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSubCategory(sc.name)}
                  className={`px-3 py-1.5 text-sm rounded-full border-2 transition-all ${
                    subCategory === sc.name
                      ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-400'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {sc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 긴급도 & 데드라인 */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              긴급도 <span className="text-gray-400 text-xs font-normal">(선택사항)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '', label: '없음', color: 'bg-gray-100 text-gray-600 border-gray-200' },
                { value: 'urgent', label: '긴급', color: 'bg-red-100 text-red-700 border-red-300' },
                { value: 'high', label: '높음', color: 'bg-orange-100 text-orange-700 border-orange-300' },
                { value: 'normal', label: '보통', color: 'bg-blue-100 text-blue-700 border-blue-300' },
                { value: 'low', label: '낮음', color: 'bg-gray-100 text-gray-600 border-gray-300' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as Priority)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-all ${
                    priority === p.value
                      ? `${p.color} ring-2 ring-offset-1 ring-current`
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              데드라인 <span className="text-gray-400 text-xs font-normal">(선택사항)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="데드라인 제거"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 게시글 유형 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            게시글 유형 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPostType('free')}
              className={`relative p-4 border-2 rounded-xl text-left transition-all ${
                postType === 'free'
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    postType === 'free'
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">자유 게시글</div>
                  <div className="text-sm text-gray-500">자유롭게 의견을 작성합니다</div>
                </div>
              </div>
              {postType === 'free' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPostType('poll')}
              className={`relative p-4 border-2 rounded-xl text-left transition-all ${
                postType === 'poll'
                  ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    postType === 'poll'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">투표</div>
                  <div className="text-sm text-gray-500">투표로 의견을 수렴합니다</div>
                </div>
              </div>
              {postType === 'poll' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* 자유 게시글: 내용 에디터 */}
        {postType === 'free' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용 <span className="text-red-500">*</span>
            </label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="안건 내용을 작성하세요..."
              rows={12}
            />
          </div>
        )}

        {/* 투표: 설명 + 옵션 설정 */}
        {postType === 'poll' && (
          <div className="mb-6 space-y-6">
            {/* 투표 설명 (선택사항) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                투표 설명 <span className="text-gray-400 text-xs font-normal">(선택사항)</span>
              </label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder="투표에 대한 설명, 참고 이미지 등을 추가하세요..."
                rows={6}
              />
            </div>

            {/* 투표 항목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                투표 항목 <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-2">(최소 2개)</span>
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`항목 ${index + 1}`}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-purple-600 border border-dashed border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                항목 추가
              </button>
            </div>

            {/* 투표 옵션 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">투표 설정</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">중복 선택 허용</span>
                  <p className="text-xs text-gray-500">여러 항목을 동시에 선택할 수 있습니다</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">비밀 투표</span>
                  <p className="text-xs text-gray-500">투표자의 이름이 공개되지 않습니다</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href="/meetings"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                등록 중...
              </span>
            ) : (
              '안건 등록'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
