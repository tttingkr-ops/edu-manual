// Created: 2026-02-01 20:40:00
// AI 채점 API - Claude를 사용한 주관식 답변 채점

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gradeSubjectiveAnswer } from '@/lib/claude'

// Service Role 클라이언트 (RLS 우회)
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId, answerText, imageUrl, userId, testResultId } = body

    if (!questionId || !userId) {
      return NextResponse.json(
        { error: 'questionId와 userId가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!answerText && !imageUrl) {
      return NextResponse.json(
        { error: '답변 텍스트 또는 이미지가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // 문제 정보 가져오기
    const { data: question, error: questionError } = await supabase
      .from('test_questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (question.question_type !== 'subjective') {
      return NextResponse.json(
        { error: '주관식 문제만 AI 채점이 가능합니다.' },
        { status: 400 }
      )
    }

    // AI 채점 실행
    const gradingResult = await gradeSubjectiveAnswer({
      question: question.question,
      answerText: answerText || '',
      imageUrl,
      gradingCriteria: question.grading_criteria || '채점 기준 없음',
      modelAnswer: question.model_answer,
      maxScore: question.max_score || 10,
    })

    // 답변 저장/업데이트
    const { data: existingAnswer } = await supabase
      .from('subjective_answers')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .maybeSingle()

    const answerData = {
      question_id: questionId,
      user_id: userId,
      test_result_id: testResultId || null,
      answer_text: answerText,
      image_url: imageUrl || null,
      ai_score: gradingResult.score,
      ai_feedback: JSON.stringify({
        feedback: gradingResult.feedback,
        strengths: gradingResult.strengths,
        improvements: gradingResult.improvements,
      }),
      ai_graded_at: new Date().toISOString(),
      status: 'ai_graded',
    }

    if (existingAnswer) {
      // 기존 답변 업데이트
      const { error: updateError } = await supabase
        .from('subjective_answers')
        .update(answerData)
        .eq('id', existingAnswer.id)

      if (updateError) throw updateError
    } else {
      // 새 답변 저장
      const { error: insertError } = await supabase
        .from('subjective_answers')
        .insert(answerData)

      if (insertError) throw insertError
    }

    return NextResponse.json({
      success: true,
      result: {
        score: gradingResult.score,
        maxScore: question.max_score || 10,
        feedback: gradingResult.feedback,
        strengths: gradingResult.strengths,
        improvements: gradingResult.improvements,
      },
    })
  } catch (error: any) {
    console.error('Grading API error:', error)
    return NextResponse.json(
      { error: error.message || 'AI 채점 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
