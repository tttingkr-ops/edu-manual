// Created: 2026-01-27 17:35:00
import TestContent from './TestContent'
import { mockTestQuestions } from '@/lib/mock-data'

interface PageProps {
  params: Promise<{ category: string }>
}

export default async function TestPage({ params }: PageProps) {
  const { category } = await params
  const decodedCategory = decodeURIComponent(category)

  // Mock 모드에서는 mockTestQuestions 사용
  let questions = []

  if (decodedCategory === '전체') {
    // 전체 테스트: 모든 카테고리에서 랜덤으로 20문제
    const shuffled = [...mockTestQuestions].sort(() => Math.random() - 0.5)
    questions = shuffled.slice(0, 20)
  } else {
    // 카테고리별 테스트
    questions = mockTestQuestions.filter((q) => q.category === decodedCategory)
  }

  const categoryTitle =
    decodedCategory === '전체'
      ? '전체 테스트'
      : decodedCategory.replace(/_/g, ' ')

  return (
    <TestContent
      questions={questions}
      category={decodedCategory}
      categoryTitle={categoryTitle}
    />
  )
}
