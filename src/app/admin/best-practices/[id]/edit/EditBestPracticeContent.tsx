// Created: 2026-02-23 00:00:00
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MarkdownEditor from '@/components/MarkdownEditor'

interface Post {
  id: string
  title: string
  content: string
  situation_tag: string | null
  targeting_type: 'group' | 'individual'
  created_at: string
  updated_at: string
}

interface Props {
  post: Post
  initialGroups: string[]
  initialTargetUsers: string[]
  groups: { id: string; name: string }[]
  managers: { id: string; username: string; nickname: string | null }[]
}

export default function EditBestPracticeContent({ post, initialGroups, initialTargetUsers, groups, managers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content)
  const [situationTag, setSituationTag] = useState(post.situation_tag || '')
  const [targetingType, setTargetingType] = useState<'group' | 'individual'>(post.targeting_type)
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialGroups)
  const [selectedManagers, setSelectedManagers] = useState<string[]>(initialTargetUsers)
  const [managerSearch, setManagerSearch] = useState('')

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
      const { error: updateError } = await supabase
        .from('best_practice_posts')
        .update({ title, content, situation_tag: situationTag.trim() || null, targeting_type: targetingType, updated_at: new Date().toISOString() })
        .eq('id', post.id)

      if (updateError) throw updateError

      await supabase.from('best_practice_groups').delete().eq('post_id', post.id)
      await supabase.from('best_practice_target_users').delete().eq('post_id', post.id)

      if (targetingType === 'group') {
        await supabase.from('best_practice_groups').insert(
          selectedGroups.map(gn => ({ post_id: post.id, group_name: gn }))
        )
      } else {
        await supabase.from('best_practice_target_users').insert(
          selectedManagers.map(uid => ({ post_id: post.id, user_id: uid }))
        )
      }

      router.refresh()
      router.push('/admin/best-practices')
    } catch (err: any) {
      setError(err.message || '수정 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await supabase.from('best_practice_groups').delete().eq('post_id', post.id)
      await supabase.from('best_practice_target_users').delete().eq('post_id', post.id)
      await supabase.from('best_practice_read_status').delete().eq('post_id', post.id)
      await supabase.from('best_practice_posts').delete().eq('id', post.id)
      router.refresh()
      router.push('/admin/best-practices')
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/admin/best-practices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-3 group">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록으로 돌아가기
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">모범사례 수정</h1>
          <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            삭제
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상황 태그</label>
            <input type="text" value={situationTag} onChange={e => setSituationTag(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="예: 예약 변경, 서비스 안내" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">대상 지정 <span className="text-red-500">*</span></label>
            <div className="flex gap-4 mb-4">
              <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer ${targetingType === 'group' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <input type="radio" name="targeting_type" value="group" checked={targetingType === 'group'} onChange={() => setTargetingType('group')} className="sr-only" />
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${targetingType === 'group' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div><p className="font-medium">그룹 지정</p><p className="text-sm text-gray-500">선택한 그룹 탭에 노출</p></div>
              </label>
              <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer ${targetingType === 'individual' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <input type="radio" name="targeting_type" value="individual" checked={targetingType === 'individual'} onChange={() => setTargetingType('individual')} className="sr-only" />
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${targetingType === 'individual' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div><p className="font-medium">개인 지정</p><p className="text-sm text-gray-500">매니저 개별 지정</p></div>
              </label>
            </div>

            {targetingType === 'group' && (
              <div className="space-y-2">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedGroups.includes(g.name)} onChange={e => handleGroupToggle(g.name, e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                    <span className="text-gray-700">{g.name}</span>
                  </label>
                ))}
              </div>
            )}

            {targetingType === 'individual' && (
              <div>
                <input type="text" value={managerSearch} onChange={e => setManagerSearch(e.target.value)} placeholder="매니저 이름 검색..." className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                  {filteredManagers.map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedManagers.includes(m.id)} onChange={e => handleManagerToggle(m.id, e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                      <span>{m.username}{m.nickname && <span className="text-gray-400 ml-1">({m.nickname})</span>}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">내용</h2>
          <MarkdownEditor value={content} onChange={setContent} rows={15} />
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex justify-between text-sm text-gray-500">
          <span>생성일: {new Date(post.created_at).toLocaleString('ko-KR')}</span>
          <span>수정일: {new Date(post.updated_at).toLocaleString('ko-KR')}</span>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600">{error}</p></div>}

        <div className="flex items-center justify-end gap-3">
          <Link href="/admin/best-practices" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">취소</Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {isSubmitting ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
