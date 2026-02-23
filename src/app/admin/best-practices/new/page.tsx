// Created: 2026-02-23 00:00:00
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MarkdownEditor from '@/components/MarkdownEditor'

export default function NewBestPracticePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [managers, setManagers] = useState<{ id: string; username: string; nickname: string | null }[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [selectedManagers, setSelectedManagers] = useState<string[]>([])
  const [targetingType, setTargetingType] = useState<'group' | 'individual'>('group')
  const [managerSearch, setManagerSearch] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [situationTag, setSituationTag] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: groupsData }, { data: managersData }] = await Promise.all([
        supabase.from('groups').select('id, name').order('name'),
        supabase.from('users').select('id, username, nickname').eq('role', 'manager').order('username'),
      ])
      setGroups(groupsData || [])
      setManagers(managersData || [])
    }
    fetchData()
  }, [])

  const filteredManagers = managers.filter(m => {
    const s = managerSearch.toLowerCase()
    return m.username.toLowerCase().includes(s) || (m.nickname?.toLowerCase().includes(s) ?? false)
  })

  const handleGroupToggle = (name: string, checked: boolean) => {
    setSelectedGroups(prev => checked ? [...prev, name] : prev.filter(g => g !== name))
  }

  const handleManagerToggle = (id: string, checked: boolean) => {
    setSelectedManagers(prev => checked ? [...prev, id] : prev.filter(m => m !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (targetingType === 'group' && selectedGroups.length === 0) {
      setError('대상 그룹을 최소 1개 이상 선택해주세요.')
      return
    }
    if (targetingType === 'individual' && selectedManagers.length === 0) {
      setError('대상 매니저를 최소 1명 이상 선택해주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const { data, error: insertError } = await supabase
        .from('best_practice_posts')
        .insert({
          title,
          content,
          situation_tag: situationTag.trim() || null,
          author_id: user.id,
          targeting_type: targetingType,
        })
        .select()
        .single()

      if (insertError) throw insertError

      if (targetingType === 'group') {
        await supabase.from('best_practice_groups').insert(
          selectedGroups.map(gn => ({ post_id: data.id, group_name: gn }))
        )
      } else {
        await supabase.from('best_practice_target_users').insert(
          selectedManagers.map(uid => ({ post_id: data.id, user_id: uid }))
        )
      }

      router.refresh()
      router.push('/admin/best-practices')
    } catch (err: any) {
      setError(err.message || '등록 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-primary-600">대시보드</Link>
          <span>/</span>
          <Link href="/admin/best-practices" className="hover:text-primary-600">모범사례 관리</Link>
          <span>/</span>
          <span>새 모범사례</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">새 모범사례 등록</h1>
        <p className="mt-1 text-gray-600">카카오톡 대화 캡처 등 모범이 될 만한 사례를 등록합니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="예: 예약 변경 요청 응대 - 친절하고 빠른 처리"
              required
            />
          </div>

          {/* 상황 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상황 태그</label>
            <input
              type="text"
              value={situationTag}
              onChange={e => setSituationTag(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="예: 예약 변경, 서비스 안내, 클레임 대응"
            />
            <p className="mt-1 text-sm text-gray-500">상황을 한 단어 또는 짧은 문구로 표현하세요 (선택사항).</p>
          </div>

          {/* 대상 지정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대상 지정 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4 mb-4">
              <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${targetingType === 'group' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="targeting_type" value="group" checked={targetingType === 'group'} onChange={() => setTargetingType('group')} className="sr-only" />
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${targetingType === 'group' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">그룹 지정</p>
                  <p className="text-sm text-gray-500">선택한 그룹 탭에 자동으로 노출됩니다.</p>
                </div>
              </label>

              <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${targetingType === 'individual' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="targeting_type" value="individual" checked={targetingType === 'individual'} onChange={() => setTargetingType('individual')} className="sr-only" />
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${targetingType === 'individual' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">개인 지정</p>
                  <p className="text-sm text-gray-500">매니저 개별 지정</p>
                </div>
              </label>
            </div>

            {targetingType === 'group' && (
              <div className="space-y-2">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedGroups.includes(g.name)} onChange={e => handleGroupToggle(g.name, e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span className="text-gray-700">{g.name}</span>
                  </label>
                ))}
                <p className="mt-1 text-sm text-gray-500">복수 선택 시 모든 탭에 노출됩니다.</p>
              </div>
            )}

            {targetingType === 'individual' && (
              <div>
                <input type="text" value={managerSearch} onChange={e => setManagerSearch(e.target.value)} placeholder="매니저 이름 검색..." className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                  {filteredManagers.map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedManagers.includes(m.id)} onChange={e => handleManagerToggle(m.id, e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                      <span className="text-gray-700">{m.username}{m.nickname && <span className="text-gray-400 ml-1">({m.nickname})</span>}</span>
                    </label>
                  ))}
                </div>
                {selectedManagers.length > 0 && <p className="mt-2 text-sm text-primary-600">{selectedManagers.length}명 선택됨</p>}
              </div>
            )}
          </div>
        </div>

        {/* 내용 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">내용</h2>
          <p className="text-sm text-gray-500 mb-3">카카오톡 대화 캡처 이미지와 해설을 입력하세요. 이미지는 드래그하거나 붙여넣어 추가할 수 있습니다.</p>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder={`# 모범 대화 예시\n\n이미지를 드래그하거나 붙여넣어 대화 캡처를 추가하세요.\n\n## 좋은 점\n- 빠른 응답\n- 친절한 어투\n\n## 적용 포인트\n이 대화에서 배울 수 있는 핵심 포인트를 적어주세요.`}
            rows={15}
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/admin/best-practices" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            취소
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
