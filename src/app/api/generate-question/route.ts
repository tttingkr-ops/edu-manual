// Created: 2026-02-05 12:00:00
// AI 문제 자동 생성 API - Claude를 사용하여 교육 자료에서 문제 생성

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.')
  }
  return new Anthropic({ apiKey })
}

export async function POST(request: NextRequest) {
  try {
    const { content, questionType, category } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json(
        { error: '교육 자료 내용이 필요합니다.' },
        { status: 400 }
      )
    }

    const anthropic = getAnthropicClient()

    const isMultipleChoice = questionType === 'multiple_choice'

    const systemPrompt = `당신은 매니저 교육 프로그램의 문제 출제 전문가입니다.
주어진 교육 자료를 분석하여 교육 효과를 측정할 수 있는 좋은 문제를 만듭니다.
카테고리: ${category}

반드시 다음 JSON 형식으로만 응답하세요:`

    let userPrompt: string
    if (isMultipleChoice) {
      userPrompt = `다음 교육 자료를 바탕으로 객관식(4지선다) 문제를 1개 만들어주세요.

## 교육 자료
${content.substring(0, 3000)}

## 요구사항
- 교육 내용의 핵심을 확인하는 실용적인 문제
- 4개의 선택지 중 정답이 명확해야 함
- 오답도 그럴듯해야 함
- 실제 업무 상황에 적용 가능한 문제

JSON 형식:
{
  "question": "문제 내용",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct_answer": 0,
  "max_score": 10
}`
    } else {
      userPrompt = `다음 교육 자료를 바탕으로 주관식 문제를 1개 만들어주세요.

## 교육 자료
${content.substring(0, 3000)}

## 요구사항
- 교육 내용의 이해도를 심층적으로 확인하는 문제
- 실제 업무 상황을 시나리오로 제시
- 명확한 채점 기준 제시
- 모범 답안 포함

JSON 형식:
{
  "question": "문제 내용 (구체적인 상황을 제시)",
  "grading_criteria": "채점 기준 (구체적으로)",
  "model_answer": "모범 답안",
  "max_score": 10
}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = response.content.find((b) => b.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON response')
    }

    const result = JSON.parse(jsonMatch[0])

    return NextResponse.json({ success: true, question: result })
  } catch (error: unknown) {
    console.error('Generate question error:', error)
    const message =
      error instanceof Error ? error.message : '문제 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
