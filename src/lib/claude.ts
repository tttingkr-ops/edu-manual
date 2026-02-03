// Created: 2026-02-01 20:35:00
// Claude API 클라이언트 - 주관식 답변 AI 채점용

import Anthropic from '@anthropic-ai/sdk'

// 클라이언트를 런타임에 생성 (빌드 시점 오류 방지)
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.')
  }
  return new Anthropic({ apiKey })
}

export interface GradingRequest {
  question: string
  answerText: string
  imageUrl?: string | null
  gradingCriteria: string
  modelAnswer?: string | null
  maxScore: number
}

export interface GradingResult {
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
}

export async function gradeSubjectiveAnswer(request: GradingRequest): Promise<GradingResult> {
  const { question, answerText, imageUrl, gradingCriteria, modelAnswer, maxScore } = request

  const systemPrompt = `당신은 매니저 교육 프로그램의 채점 전문가입니다.
주어진 문제에 대한 답변을 채점 기준에 따라 공정하고 상세하게 평가합니다.
점수는 0점부터 ${maxScore}점까지 부여할 수 있습니다.

채점 시 다음 사항을 고려하세요:
1. 답변이 문제의 핵심을 이해하고 있는지
2. 채점 기준에 명시된 요소들이 포함되어 있는지
3. 실제 상황에서 적용 가능한 답변인지
4. 전문성과 공감 능력이 드러나는지

응답은 반드시 다음 JSON 형식으로 해주세요:
{
  "score": 점수(숫자),
  "feedback": "전체적인 평가 코멘트",
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선할 점 1", "개선할 점 2"]
}`

  let userMessage = `## 문제
${question}

## 채점 기준
${gradingCriteria}
`

  if (modelAnswer) {
    userMessage += `
## 모범 답안 (참고용)
${modelAnswer}
`
  }

  userMessage += `
## 학생 답변
${answerText}

위 답변을 채점해주세요. 배점은 ${maxScore}점입니다.`

  try {
    // 이미지가 있는 경우 Vision API 사용
    const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = imageUrl
      ? [
          {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl,
            },
          } as Anthropic.ImageBlockParam,
          {
            type: 'text',
            text: userMessage + '\n\n위 이미지는 답변과 함께 제출된 참고 자료입니다. 이미지 내용도 함께 고려하여 채점해주세요.',
          },
        ]
      : userMessage

    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    })

    // 응답 파싱
    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON response')
    }

    const result = JSON.parse(jsonMatch[0]) as GradingResult

    // 점수 범위 검증
    if (result.score < 0) result.score = 0
    if (result.score > maxScore) result.score = maxScore

    return result
  } catch (error) {
    console.error('Claude grading error:', error)
    throw new Error('AI 채점 중 오류가 발생했습니다.')
  }
}
