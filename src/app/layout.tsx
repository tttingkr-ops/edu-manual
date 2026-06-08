// Created: 2026-01-27 16:30:00
import type { Metadata } from 'next'
import '@fontsource-variable/inter/wght.css'
import './globals.css'

export const metadata: Metadata = {
  title: '팅팅팅 교육 시스템',
  description: '팅팅팅 내부 교육 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
