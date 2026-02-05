// Created: 2026-02-05 21:50:01
// Updated: 2026-02-05 - Fix JSON parse error, use Notion loadPageChunk API
// Notion public page import API - Import content from Notion into educational_posts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_CATEGORIES = [
  '남자_매니저_대화',
  '여자_매니저_대화',
  '여자_매니저_소개',
  '추가_서비스_규칙',
] as const

type CategoryType = typeof ALLOWED_CATEGORIES[number]

// Extract Notion page ID from URL
function extractPageId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    if (!urlObj.hostname.includes('notion.so')) {
      return null
    }

    // Remove query params and get just the path
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)
    const lastSegment = pathSegments[pathSegments.length - 1]

    if (!lastSegment) {
      return null
    }

    // Notion page IDs are 32 hex characters, often at the end of the slug after a dash
    // Example: "1-2ca66d5464c280dab6cfe43f3ef534ba" -> "2ca66d5464c280dab6cfe43f3ef534ba"
    // Example: "Page-Title-abc123def456abc123def456" -> "abc123def456abc123def456"
    const hexMatch = lastSegment.match(/([a-f0-9]{32})$/i)
    if (hexMatch) {
      return hexMatch[1]
    }

    // Try the full segment without dashes
    const noDashes = lastSegment.replace(/-/g, '')
    if (noDashes.length >= 32 && /[a-f0-9]{32}$/i.test(noDashes)) {
      const match = noDashes.match(/([a-f0-9]{32})$/i)
      return match ? match[1] : null
    }

    return null
  } catch {
    return null
  }
}

// Format page ID with dashes for Notion API
function formatPageId(id: string): string {
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
}

// Fetch Notion page content using loadPageChunk (works for public pages)
async function fetchNotionContent(pageId: string): Promise<{ title: string; content: string }> {
  const formattedId = formatPageId(pageId)

  const response = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      page: { id: formattedId },
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  })

  // Always read as text first to avoid JSON parse errors
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Notion API returned ${response.status}: ${responseText.substring(0, 200)}`)
  }

  if (!responseText.trim()) {
    throw new Error('Notion API returned empty response')
  }

  let data: any
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    throw new Error('Notion API returned invalid JSON')
  }

  // Extract content from recordMap
  const recordMap = data?.recordMap
  if (!recordMap?.block) {
    throw new Error('페이지 데이터를 가져올 수 없습니다.')
  }

  let title = ''
  const contentLines: string[] = []

  const blocks = recordMap.block
  for (const blockId in blocks) {
    const block = blocks[blockId]?.value
    if (!block) continue

    const blockType = block.type
    const properties = block.properties

    if (!properties?.title) continue

    // Extract text from title property (Notion rich text format)
    const text = (properties.title as any[][])
      .map((segment: any[]) => segment[0] || '')
      .join('')
      .trim()

    if (!text) continue

    if (blockType === 'page' && !title) {
      title = text
    } else if (blockType === 'header') {
      contentLines.push(`## ${text}`)
    } else if (blockType === 'sub_header') {
      contentLines.push(`### ${text}`)
    } else if (blockType === 'sub_sub_header') {
      contentLines.push(`#### ${text}`)
    } else if (blockType === 'bulleted_list') {
      contentLines.push(`- ${text}`)
    } else if (blockType === 'numbered_list') {
      contentLines.push(`1. ${text}`)
    } else if (blockType === 'to_do') {
      const checked = properties.checked?.[0]?.[0] === 'Yes'
      contentLines.push(`- [${checked ? 'x' : ' '}] ${text}`)
    } else if (blockType === 'toggle') {
      contentLines.push(`**${text}**`)
    } else if (blockType === 'quote') {
      contentLines.push(`> ${text}`)
    } else if (blockType === 'callout') {
      contentLines.push(`> ${text}`)
    } else if (blockType === 'code') {
      const language = properties.language?.[0]?.[0] || ''
      contentLines.push(`\`\`\`${language}\n${text}\n\`\`\``)
    } else if (blockType === 'divider') {
      contentLines.push('---')
    } else {
      // text, paragraph, etc.
      contentLines.push(text)
    }
  }

  if (!title && contentLines.length > 0) {
    title = contentLines[0].replace(/^#+\s*/, '').substring(0, 100)
  }

  const fullContent = contentLines.join('\n\n')

  if (!title && !fullContent) {
    throw new Error('페이지에서 콘텐츠를 추출할 수 없습니다. 비공개 페이지이거나 내용이 없습니다.')
  }

  return {
    title: title || '제목 없음',
    content: fullContent || '(내용 없음)',
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read request body as text first to handle empty/invalid body
    const bodyText = await request.text()
    if (!bodyText.trim()) {
      return NextResponse.json(
        { error: '요청 본문이 비어있습니다.' },
        { status: 400 }
      )
    }

    let body: any
    try {
      body = JSON.parse(bodyText)
    } catch {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      )
    }

    const { url, category } = body

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Notion URL이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!url.includes('notion.so/')) {
      return NextResponse.json(
        { error: '유효한 Notion URL이 아닙니다.' },
        { status: 400 }
      )
    }

    // Validate category
    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `카테고리는 다음 중 하나여야 합니다: ${ALLOWED_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다. 로그인해주세요.' },
        { status: 401 }
      )
    }

    // Extract page ID
    const pageId = extractPageId(url)
    if (!pageId) {
      return NextResponse.json(
        { error: 'Notion URL에서 페이지 ID를 추출할 수 없습니다. URL 형식을 확인해주세요.' },
        { status: 400 }
      )
    }

    // Fetch Notion page content
    const { title, content } = await fetchNotionContent(pageId)

    // Insert into educational_posts using admin client
    const adminClient = createAdminClient()
    const { data: post, error: insertError } = await adminClient
      .from('educational_posts')
      .insert({
        title,
        content_type: 'document' as const,
        content: `# ${title}\n\n${content}`,
        category: category as CategoryType,
        author_id: user.id,
      })
      .select('id, title')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error('게시물을 저장하는 중 오류가 발생했습니다.')
    }

    return NextResponse.json({
      title: post.title,
    })
  } catch (error: any) {
    console.error('Notion import API error:', error)
    return NextResponse.json(
      { error: error.message || 'Notion 가져오기 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
