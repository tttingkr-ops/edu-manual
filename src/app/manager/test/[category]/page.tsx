// Created: 2026-01-27 17:35:00
// Updated: 2026-02-01 - 주관식 문제 지원 (question_type, max_score 등 추가)
// Updated: 2026-02-14 - 재테스트, 개인 할당 문제, 타겟팅 필터링 추가
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TestContent from './TestContent'

interface PageProps {
  params: Promise<{ category: string }>
  searchParams: Promise<{ retestId?: string }>
}

export default async function TestPage({ params, searchParams }: PageProps) {
  const { category } = await params
  const { retestId } = await searchParams
  const decodedCategory = decodeURIComponent(category)
  const supabase = await createClient()

  // 현재 사용자 조회
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 그룹 조회 → 허용 카테고리 계산
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select('group_id, groups(name)')
    .eq('user_id', user.id)

  const userGroupNames = (userGroups || []).map((ug: any) => ug.groups?.name).filter(Boolean)
  const allowedCategories = userGroupNames.length > 0
    ? userGroupNames.map((name: string) => name.replace(/ /g, '_'))
    : null // null = 모든 카테고리

  // 카테고리 접근 권한 검증 ("전체", "내_할당_문제"는 항상 허용)
  const alwaysAllowed = ['전체', '내_할당_문제']
  if (!alwaysAllowed.includes(decodedCategory) && allowedCategories && !allowedCategories.includes(decodedCategory)) {
    redirect('/manager/test')
  }

  // 문제 조회
  interface Question {
    id: string
    category: string
    sub_category: string | null
    question: string
    question_type: 'multiple_choice' | 'subjective'
    question_image_url: string | null
    options: string[] | null
    correct_answer: number[] | null
    max_score: number
    grading_criteria: string | null
    model_answer: string | null
    related_post_id: string | null
  }

  let questions: Question[] = []
  let retestInfo: { id: string; reason: string | null; category: string | null } | null = null

  // 재테스트 모드
  if (retestId) {
    const { data: assignment } = await supabase
      .from('retest_assignments')
      .select('*')
      .eq('id', retestId)
      .eq('manager_id', user.id)
      .eq('status', 'pending')
      .single()

    if (assignment) {
      retestInfo = { id: assignment.id, reason: assignment.reason, category: assignment.category }

      if (assignment.question_ids && (assignment.question_ids as string[]).length > 0) {
        // 특정 문제만 로드
        const { data } = await supabase
          .from('test_questions')
          .select('*')
          .in('id', assignment.question_ids as string[])

        questions = (data || []).map(q => ({
          ...q,
          question_type: q.question_type || 'multiple_choice',
          question_image_url: q.question_image_url || null,
          options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
          max_score: q.max_score || 10,
          correct_answer: Array.isArray(q.correct_answer)
            ? (q.correct_answer as number[])
            : q.correct_answer !== null && q.correct_answer !== undefined
            ? [q.correct_answer as unknown as number]
            : null,
        }))
      } else if (assignment.category) {
        // 해당 카테고리 전체 로드
        const { data } = await supabase
          .from('test_questions')
          .select('*')
          .eq('category', assignment.category)

        questions = (data || []).map(q => ({
          ...q,
          question_type: q.question_type || 'multiple_choice',
          question_image_url: q.question_image_url || null,
          options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
          max_score: q.max_score || 10,
          correct_answer: Array.isArray(q.correct_answer)
            ? (q.correct_answer as number[])
            : q.correct_answer !== null && q.correct_answer !== undefined
            ? [q.correct_answer as unknown as number]
            : null,
        }))
      }
    }
  } else if (decodedCategory === '내_할당_문제') {
    // 나에게 타겟된 게시물의 test_visibility='targeted' 문제만 조회
    const { data: targetedPosts } = await supabase
      .from('post_target_users')
      .select('post_id, educational_posts(id, test_visibility)')
      .eq('user_id', user.id)

    const targetedPostIds = (targetedPosts || [])
      .filter((tp: any) => tp.educational_posts?.test_visibility === 'targeted')
      .map((tp: any) => tp.post_id)

    if (targetedPostIds.length > 0) {
      const { data } = await supabase
        .from('test_questions')
        .select('*')
        .in('related_post_id', targetedPostIds)

      questions = (data || []).map(q => ({
        ...q,
        question_type: q.question_type || 'multiple_choice',
        question_image_url: q.question_image_url || null,
        options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
        max_score: q.max_score || 10,
        correct_answer: Array.isArray(q.correct_answer)
          ? (q.correct_answer as number[])
          : q.correct_answer !== null && q.correct_answer !== undefined
          ? [q.correct_answer as unknown as number]
          : null,
      }))
    }
  } else if (decodedCategory === '전체') {
    // 전체 테스트: 허용 카테고리에서 랜덤으로 20문제
    let query = supabase.from('test_questions').select('*, educational_posts(test_visibility)')
    if (allowedCategories) {
      query = query.in('category', allowedCategories)
    }
    const { data } = await query

    if (data) {
      // test_visibility='targeted'인 게시물의 문제는 타겟 사용자에게만 표시
      const { data: userTargetPosts } = await supabase
        .from('post_target_users')
        .select('post_id')
        .eq('user_id', user.id)

      const userTargetPostIds = new Set((userTargetPosts || []).map((tp: any) => tp.post_id))

      const filteredData = data.filter((q: any) => {
        const visibility = q.educational_posts?.test_visibility
        if (visibility === 'targeted') {
          return userTargetPostIds.has(q.related_post_id)
        }
        return true // 'all' or no visibility set
      })

      const shuffled = [...filteredData].sort(() => Math.random() - 0.5)
      questions = shuffled.slice(0, 20).map((q: any) => ({
        ...q,
        educational_posts: undefined,
        question_type: q.question_type || 'multiple_choice',
        question_image_url: q.question_image_url || null,
        options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
        max_score: q.max_score || 10,
        correct_answer: Array.isArray(q.correct_answer)
          ? (q.correct_answer as number[])
          : q.correct_answer !== null && q.correct_answer !== undefined
          ? [q.correct_answer as unknown as number]
          : null,
      }))
    }
  } else {
    // 카테고리별 테스트 (개인_피드백 포함)
    const { data } = await supabase
      .from('test_questions')
      .select('*, educational_posts(test_visibility)')
      .eq('category', decodedCategory)

    // test_visibility='targeted' 필터링
    const { data: userTargetPosts } = await supabase
      .from('post_target_users')
      .select('post_id')
      .eq('user_id', user.id)

    const userTargetPostIds = new Set((userTargetPosts || []).map((tp: any) => tp.post_id))

    const filteredData = (data || []).filter((q: any) => {
      const visibility = q.educational_posts?.test_visibility
      if (visibility === 'targeted') {
        return userTargetPostIds.has(q.related_post_id)
      }
      return true
    })

    questions = filteredData.map((q: any) => ({
      ...q,
      educational_posts: undefined,
      question_type: q.question_type || 'multiple_choice',
      question_image_url: q.question_image_url || null,
      options: q.question_type === 'subjective' ? null : ((q.options as string[]) || []),
      max_score: q.max_score || 10,
    }))
  }

  const categoryTitle =
    decodedCategory === '전체'
      ? '전체 테스트'
      : decodedCategory === '내_할당_문제'
      ? '나에게 할당된 문제'
      : decodedCategory.replace(/_/g, ' ')

  return (
    <TestContent
      questions={questions}
      category={decodedCategory}
      categoryTitle={categoryTitle}
      userId={user.id}
      retestInfo={retestInfo}
    />
  )
}
