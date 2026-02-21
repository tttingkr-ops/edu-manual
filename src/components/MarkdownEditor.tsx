// Created: 2026-02-03 10:30:00
// 마크다운 에디터 - WYSIWYG 스타일 이미지 편집
// Updated: 2026-02-03 - 비주얼 모드 기본, 이미지 인라인 표시
'use client'

import { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  onImageUpload?: (url: string) => void
}

interface ContentBlock {
  id: string
  type: 'text' | 'image'
  content: string // text일 경우 텍스트, image일 경우 URL
  alt?: string // image일 경우 alt 텍스트
}

// 이미지 압축 함수
const compressImage = async (file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        quality
      )
    }
    img.src = URL.createObjectURL(file)
  })
}

// 마크다운을 블록으로 파싱 (자유 형식: 텍스트는 내용이 있을 때만, 마지막은 항상 텍스트)
const parseMarkdownToBlocks = (markdown: string): ContentBlock[] => {
  const blocks: ContentBlock[] = []
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g

  let lastIndex = 0
  let match
  let blockId = 0

  while ((match = imageRegex.exec(markdown)) !== null) {
    // 이미지 앞 텍스트 (내용이 있을 때만 추가)
    const text = markdown.slice(lastIndex, match.index).trim()
    if (text) {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'text',
        content: text,
      })
    }

    // 이미지 블록
    blocks.push({
      id: `block-${blockId++}`,
      type: 'image',
      content: match[2],
      alt: match[1] || '이미지',
    })

    lastIndex = match.index + match[0].length
  }

  // 나머지 텍스트
  const remaining = markdown.slice(lastIndex).trim()
  if (remaining) {
    blocks.push({
      id: `block-${blockId++}`,
      type: 'text',
      content: remaining,
    })
  }

  // 마지막 블록이 텍스트가 아니면 빈 텍스트 추가 (항상 타이핑 가능하도록)
  if (blocks.length === 0 || blocks[blocks.length - 1].type !== 'text') {
    blocks.push({
      id: `block-${blockId++}`,
      type: 'text',
      content: '',
    })
  }

  return blocks
}

// 블록을 마크다운으로 변환 (빈 텍스트 블록은 마크다운에서 제외)
const blocksToMarkdown = (blocks: ContentBlock[]): string => {
  return blocks
    .map(block => {
      if (block.type === 'image') {
        return `![${block.alt || '이미지'}](${block.content})`
      }
      return block.content
    })
    .filter(text => text !== '')
    .join('\n\n')
}

function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 15,
  onImageUpload,
}: MarkdownEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => parseMarkdownToBlocks(value))
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showCodeMode, setShowCodeMode] = useState(false)
  const [codeValue, setCodeValue] = useState(value)
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const dragCounterRef = useRef(0)
  const isInternalChangeRef = useRef(false)
  const isBlockDragRef = useRef(false)
  const draggedBlockIdRef = useRef<string | null>(null)
  const dropTargetIndexRef = useRef<number | null>(null)
  const blocksRef = useRef(blocks)
  const focusBlockIdRef = useRef<string | null>(null)
  const blocksContainerRef = useRef<HTMLDivElement>(null)
  const textareaRefsMap = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const activeFocusedBlockRef = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // 외부 value 변경 시 동기화 (내부 변경은 무시)
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }
    if (!showCodeMode) {
      setBlocks(parseMarkdownToBlocks(value))
    }
    setCodeValue(value)
  }, [value, showCodeMode])

  // 새 텍스트 블록에 자동 포커스
  useEffect(() => {
    if (focusBlockIdRef.current) {
      const el = textareaRefsMap.current.get(focusBlockIdRef.current)
      if (el) {
        el.focus()
        focusBlockIdRef.current = null
      }
    }
  }, [blocks])

  // blocksRef 동기화 (드래그 핸들러에서 최신 blocks 참조용)
  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  // 블록 변경 시 마크다운으로 변환하여 부모에 알림
  const updateBlocks = useCallback((newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks)
    const markdown = blocksToMarkdown(newBlocks)
    isInternalChangeRef.current = true
    onChange(markdown)
    setCodeValue(markdown)
  }, [onChange])

  // 이미지 업로드 처리
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('JPG, PNG, GIF, WEBP 형식만 지원됩니다.')
      return null
    }

    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert('파일 크기는 50MB 이하여야 합니다.')
      return null
    }

    setIsUploading(true)
    try {
      const compressedBlob = await compressImage(file, 1200, 0.8)

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
      const filePath = `posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('education-images')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('education-images')
        .getPublicUrl(filePath)

      onImageUpload?.(publicUrl)
      return publicUrl
    } catch (error) {
      console.error('Upload error:', error)
      alert('이미지 업로드 중 오류가 발생했습니다.')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [supabase, onImageUpload])

  // 이미지 추가 (자유 형식: 빈 텍스트 블록 앞에 삽입하여 연속 이미지 지원)
  const addImageBlock = useCallback(async (file: File, fromBlockId?: string) => {
    const url = await uploadImage(file)
    if (!url) return

    const imageBlock = {
      id: `block-${Date.now()}`,
      type: 'image' as const,
      content: url,
      alt: file.name,
    }

    const newBlocks = [...blocks]

    if (fromBlockId) {
      const blockIndex = newBlocks.findIndex(b => b.id === fromBlockId)
      const block = newBlocks[blockIndex]

      if (block && block.type === 'text' && block.content.trim() === '') {
        // 빈 텍스트 블록: 이미지를 그 앞에 삽입 (텍스트 블록은 아래에 유지)
        // → 연속 붙여넣기 시 이미지가 순서대로 쌓임
        newBlocks.splice(blockIndex, 0, imageBlock)
      } else if (block) {
        // 내용이 있는 텍스트 블록: 이미지를 그 뒤에 삽입
        newBlocks.splice(blockIndex + 1, 0, imageBlock)
      }
    } else {
      // 드래그/파일선택: 마지막 텍스트 블록 앞에 삽입
      const lastBlock = newBlocks[newBlocks.length - 1]
      if (lastBlock && lastBlock.type === 'text' && lastBlock.content.trim() === '') {
        newBlocks.splice(newBlocks.length - 1, 0, imageBlock)
      } else {
        newBlocks.push(imageBlock)
      }
    }

    // 마지막 블록이 텍스트가 아니면 추가
    if (newBlocks[newBlocks.length - 1].type !== 'text') {
      newBlocks.push({
        id: `block-${Date.now() + 1}`,
        type: 'text' as const,
        content: '',
      })
    }

    // 이미지 다음 텍스트 블록에 포커스
    const imgIndex = newBlocks.findIndex(b => b.id === imageBlock.id)
    const nextText = newBlocks.slice(imgIndex + 1).find(b => b.type === 'text')
    if (nextText) {
      focusBlockIdRef.current = nextText.id
    }

    updateBlocks(newBlocks)
  }, [blocks, uploadImage, updateBlocks])

  // 이미지 사이에 텍스트 블록 삽입
  const insertTextBlockAt = useCallback((position: number) => {
    const newBlock = {
      id: `block-${Date.now()}`,
      type: 'text' as const,
      content: '',
    }
    const newBlocks = [
      ...blocks.slice(0, position),
      newBlock,
      ...blocks.slice(position),
    ]
    focusBlockIdRef.current = newBlock.id
    updateBlocks(newBlocks)
  }, [blocks, updateBlocks])

  // 텍스트 블록 업데이트
  const updateTextBlock = useCallback((blockId: string, newContent: string) => {
    const newBlocks = blocks.map(block =>
      block.id === blockId ? { ...block, content: newContent } : block
    )
    updateBlocks(newBlocks)
  }, [blocks, updateBlocks])

  // 이미지 블록 삭제
  const removeImageBlock = useCallback((blockId: string) => {
    const newBlocks = blocks.filter(block => block.id !== blockId)
    if (newBlocks.length === 0) {
      newBlocks.push({
        id: `block-${Date.now()}`,
        type: 'text',
        content: '',
      })
    }
    updateBlocks(newBlocks)
  }, [blocks, updateBlocks])

  // 텍스트 블록 삭제 (마지막 블록은 삭제 불가)
  const removeTextBlock = useCallback((blockId: string) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId)
    if (blockIndex < 0 || blockIndex === blocks.length - 1) return
    const newBlocks = blocks.filter(b => b.id !== blockId)
    updateBlocks(newBlocks)
  }, [blocks, updateBlocks])

  // === 블록 순서 변경 (드래그 앤 드롭) - ref 기반으로 stale closure 방지 ===
  const handleBlockDragStart = useCallback((e: React.DragEvent, blockId: string) => {
    isBlockDragRef.current = true
    draggedBlockIdRef.current = blockId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', blockId)
    // 드래그 이미지: 간단한 placeholder 생성 (큰 이미지가 ghost로 잡히는 것 방지)
    const dragGhost = document.createElement('div')
    dragGhost.style.cssText = 'width:200px;height:36px;background:#e0e7ff;border:2px dashed #6366f1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#4338ca;position:absolute;top:-9999px;'
    dragGhost.textContent = '블록 이동 중...'
    document.body.appendChild(dragGhost)
    e.dataTransfer.setDragImage(dragGhost, 100, 18)
    requestAnimationFrame(() => document.body.removeChild(dragGhost))
    // state는 UI 업데이트용 (collapse 등)
    setDraggedBlockId(blockId)
  }, [])

  // ref 기반으로 최신 blocks와 draggedBlockId 참조
  const handleBlockDrop = useCallback(() => {
    const targetIndex = dropTargetIndexRef.current
    const currentDraggedId = draggedBlockIdRef.current
    const currentBlocks = blocksRef.current

    if (!currentDraggedId || targetIndex === null) {
      draggedBlockIdRef.current = null
      dropTargetIndexRef.current = null
      isBlockDragRef.current = false
      setDraggedBlockId(null)
      setDropTargetIndex(null)
      return
    }

    const sourceIndex = currentBlocks.findIndex(b => b.id === currentDraggedId)
    if (sourceIndex < 0) {
      draggedBlockIdRef.current = null
      dropTargetIndexRef.current = null
      isBlockDragRef.current = false
      setDraggedBlockId(null)
      setDropTargetIndex(null)
      return
    }

    // remove-then-insert 방식: 원본 제거 후 새 위치에 삽입
    const newBlocks = [...currentBlocks]
    const [moved] = newBlocks.splice(sourceIndex, 1)
    const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex

    // 실제 위치가 변경될 때만 업데이트
    if (insertAt !== sourceIndex) {
      newBlocks.splice(insertAt, 0, moved)

      // 마지막 블록이 텍스트가 아니면 추가
      if (newBlocks[newBlocks.length - 1].type !== 'text') {
        newBlocks.push({
          id: `block-${Date.now()}`,
          type: 'text' as const,
          content: '',
        })
      }

      updateBlocks(newBlocks)
    }

    draggedBlockIdRef.current = null
    dropTargetIndexRef.current = null
    isBlockDragRef.current = false
    setDraggedBlockId(null)
    setDropTargetIndex(null)
  }, [updateBlocks])

  const handleBlockDragEnd = useCallback(() => {
    draggedBlockIdRef.current = null
    dropTargetIndexRef.current = null
    isBlockDragRef.current = false
    setDraggedBlockId(null)
    setDropTargetIndex(null)
  }, [])

  // === 컨테이너 드래그 핸들러 (파일 업로드 + 블록 리오더링 통합) ===
  const handleContainerDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBlockDragRef.current) return
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBlockDragRef.current) return
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  // 컨테이너 dragOver: 블록 리오더링 시 드롭 위치 계산
  // 드래그 중인 블록은 collapsed 상태이므로 해당 블록 스킵 + 큰 블록에서도 작동하도록 capped threshold 사용
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()

    if (!isBlockDragRef.current || !blocksContainerRef.current) return
    e.dataTransfer.dropEffect = 'move'

    const currentDraggedId = draggedBlockIdRef.current
    const allBlockEls = Array.from(
      blocksContainerRef.current.querySelectorAll('[data-block-id]')
    )
    if (allBlockEls.length === 0) return

    // 드래그 중인 블록을 제외한 블록들만 대상으로 계산
    // capped threshold: 큰 블록이어도 최대 60px까지만 "insert before" 영역
    let targetIndex = 0

    for (let i = 0; i < allBlockEls.length; i++) {
      const el = allBlockEls[i]
      if (el.getAttribute('data-block-id') === currentDraggedId) continue

      const rect = el.getBoundingClientRect()
      const height = rect.bottom - rect.top
      // 블록 높이의 절반 또는 60px 중 작은 값을 threshold로 사용
      const threshold = Math.min(height * 0.5, 60)

      if (e.clientY > rect.top + threshold) {
        // 커서가 이 블록의 threshold를 넘었으면 → 이 블록 다음에 삽입
        targetIndex = i + 1
      }
    }

    dropTargetIndexRef.current = targetIndex
    setDropTargetIndex(targetIndex)
  }, [])

  const handleContainerDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()

    // 블록 리오더링
    if (isBlockDragRef.current) {
      handleBlockDrop()
      return
    }

    // 파일 업로드
    dragCounterRef.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    for (const file of imageFiles) {
      await addImageBlock(file)
    }
  }, [handleBlockDrop, addImageBlock])

  // 붙여넣기 핸들러 (현재 블록 뒤에 이미지 삽입)
  const handlePaste = useCallback(async (e: React.ClipboardEvent, blockId: string) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))

    if (imageItems.length === 0) return

    e.preventDefault()

    for (const item of imageItems) {
      const file = item.getAsFile()
      if (file) {
        await addImageBlock(file, blockId)
      }
    }
  }, [addImageBlock])

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    for (const file of files) {
      await addImageBlock(file)
    }

    e.target.value = ''
  }, [addImageBlock])

  // 서식 적용 (선택 텍스트를 HTML로 감쌈)
  const applyFormat = useCallback((formatType: 'size' | 'center' | 'color', value?: string) => {
    const blockId = activeFocusedBlockRef.current
    if (!blockId) return
    const textarea = textareaRefsMap.current.get(blockId)
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const content = textarea.value
    const selected = content.substring(start, end) || '텍스트'

    let wrapped: string
    if (formatType === 'size') {
      wrapped = `<span style="font-size:${value}">${selected}</span>`
    } else if (formatType === 'center') {
      wrapped = `<div style="text-align:center">${selected}</div>`
    } else if (formatType === 'color') {
      wrapped = `<span style="color:${value}">${selected}</span>`
    } else {
      return
    }

    const newContent = content.substring(0, start) + wrapped + content.substring(end)
    updateTextBlock(blockId, newContent)
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + wrapped.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 10)
  }, [updateTextBlock])

  // 코드 모드 전환
  const toggleCodeMode = useCallback(() => {
    if (showCodeMode) {
      // 코드 모드 -> 비주얼 모드
      setBlocks(parseMarkdownToBlocks(codeValue))
      onChange(codeValue)
    }
    setShowCodeMode(!showCodeMode)
  }, [showCodeMode, codeValue, onChange])

  // 코드 모드에서 변경
  const handleCodeChange = useCallback((newValue: string) => {
    setCodeValue(newValue)
    onChange(newValue)
  }, [onChange])

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="bg-gray-50 border border-gray-200 rounded-t-lg">
        {/* 1행: 이미지 추가 + 코드 모드 */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded cursor-pointer transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              이미지 추가
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {isUploading && (
              <span className="flex items-center gap-1.5 text-xs text-primary-600">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                업로드 중...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCodeMode}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              showCodeMode
                ? 'bg-gray-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showCodeMode ? '비주얼 모드' : '코드 모드'}
          </button>
        </div>
        {/* 2행: 서식 도구모음 (비주얼 모드에서만 표시) */}
        {!showCodeMode && (
          <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap">
            {/* 글씨 크기 */}
            <span className="text-xs text-gray-400 mr-1">크기:</span>
            {[
              { label: '소', value: '0.8em' },
              { label: '중', value: '1em' },
              { label: '대', value: '1.3em' },
              { label: '특대', value: '1.7em' },
            ].map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('size', value) }}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
                title={`글씨 크기: ${label}`}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 text-gray-300">|</span>
            {/* 가운데 정렬 */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyFormat('center') }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
              title="가운데 정렬"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
              </svg>
              가운데
            </button>
            <span className="mx-1 text-gray-300">|</span>
            {/* 글씨 색깔 */}
            <span className="text-xs text-gray-400 mr-1">색깔:</span>
            {[
              { color: '#111827', label: '검정' },
              { color: '#ef4444', label: '빨강' },
              { color: '#3b82f6', label: '파랑' },
              { color: '#22c55e', label: '초록' },
              { color: '#f97316', label: '주황' },
              { color: '#a855f7', label: '보라' },
            ].map(({ color, label }) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('color', color) }}
                className="w-5 h-5 rounded-full border-2 border-white shadow hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={`글씨 색: ${label}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 에디터 영역 */}
      {showCodeMode ? (
        // 코드 모드 (마크다운 직접 편집)
        <textarea
          value={codeValue}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm resize-none"
          rows={rows}
          placeholder={placeholder || '마크다운 형식으로 입력하세요...'}
        />
      ) : (
        // 비주얼 모드
        <div
          ref={blocksContainerRef}
          className={`relative border border-gray-300 rounded-b-lg bg-white min-h-[300px] transition-all ${
            isDragging ? 'ring-2 ring-primary-500 ring-offset-2' : ''
          }`}
          onDragEnter={handleContainerDragEnter}
          onDragLeave={handleContainerDragLeave}
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
        >
          <div className="p-4 space-y-1">
            {blocks.map((block, index) => {
              // 드롭 인디케이터: no-op 위치(원래 자리)에는 표시하지 않음
              const dragSourceIndex = draggedBlockId ? blocks.findIndex(b => b.id === draggedBlockId) : -1
              const isNoOp = dragSourceIndex >= 0 && (index === dragSourceIndex || index === dragSourceIndex + 1)
              return (
              <div key={block.id}>
                {/* 드롭 위치 표시선 */}
                {dropTargetIndex === index && draggedBlockId && !isNoOp && (
                  <div className="h-1 bg-primary-500 rounded my-1 shadow-sm" />
                )}

                {/* 이미지 사이 텍스트 삽입 버튼 (드래그 중 숨김) */}
                {index > 0 && block.type === 'image' && blocks[index - 1].type === 'image' && !draggedBlockId && (
                  <div
                    className="flex items-center gap-2 py-1 cursor-pointer group/insert"
                    onClick={() => insertTextBlockAt(index)}
                  >
                    <div className="flex-1 h-px bg-transparent group-hover/insert:bg-primary-300 transition-colors" />
                    <span className="text-xs text-gray-300 group-hover/insert:text-primary-500 transition-colors select-none">
                      + 텍스트 추가
                    </span>
                    <div className="flex-1 h-px bg-transparent group-hover/insert:bg-primary-300 transition-colors" />
                  </div>
                )}

                {/* 블록 (드래그 핸들 + 콘텐츠) - 드래그 중 collapse로 다른 블록 접근 용이하게 */}
                <div
                  data-block-id={block.id}
                  className={`flex items-start gap-1 group/block rounded ${
                    draggedBlockId === block.id
                      ? 'max-h-10 overflow-hidden opacity-50 border-2 border-dashed border-primary-400 bg-primary-50 rounded-md my-0.5'
                      : ''
                  }`}
                >
                  {/* 드래그 핸들 */}
                  <div
                    draggable
                    onDragStart={(e) => handleBlockDragStart(e, block.id)}
                    onDragEnd={handleBlockDragEnd}
                    className={`flex-shrink-0 mt-2 px-0.5 cursor-grab active:cursor-grabbing transition-opacity select-none ${
                      draggedBlockId ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
                    }`}
                    title="드래그하여 순서 변경"
                  >
                    <svg className="w-4 h-5 text-gray-300 hover:text-gray-500" viewBox="0 0 16 20" fill="currentColor">
                      <circle cx="5" cy="4" r="1.5"/>
                      <circle cx="11" cy="4" r="1.5"/>
                      <circle cx="5" cy="10" r="1.5"/>
                      <circle cx="11" cy="10" r="1.5"/>
                      <circle cx="5" cy="16" r="1.5"/>
                      <circle cx="11" cy="16" r="1.5"/>
                    </svg>
                  </div>

                  {/* 블록 콘텐츠 (드래그 중 pointer-events 비활성화) */}
                  <div className={`flex-1 min-w-0 ${draggedBlockId ? 'pointer-events-none' : ''}`}>
                    {block.type === 'image' ? (
                      // 이미지 블록
                      <div className="relative group my-1">
                        <img
                          src={block.content}
                          alt={block.alt || '이미지'}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeImageBlock(block.id)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="이미지 삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      // 텍스트 블록
                      <div className="relative">
                        <textarea
                          ref={(el) => {
                            if (el) textareaRefsMap.current.set(block.id, el)
                            else textareaRefsMap.current.delete(block.id)
                          }}
                          value={block.content}
                          onChange={(e) => updateTextBlock(block.id, e.target.value)}
                          onPaste={(e) => handlePaste(e, block.id)}
                          onFocus={() => { activeFocusedBlockRef.current = block.id }}
                          className="w-full px-0 py-2 border-0 focus:ring-0 resize-none text-gray-900 placeholder-gray-400"
                          rows={Math.max(2, block.content.split('\n').length)}
                          placeholder={placeholder || '내용을 입력하세요...'}
                        />
                        {/* 텍스트 블록 삭제 (마지막 블록 제외) */}
                        {index !== blocks.length - 1 && (
                          <button
                            type="button"
                            onClick={() => removeTextBlock(block.id)}
                            className="absolute top-1 right-1 p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover/block:opacity-100 transition-all"
                            title="텍스트 블록 삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )})}

            {/* 맨 아래 드롭 표시선 */}
            {dropTargetIndex === blocks.length && draggedBlockId && (() => {
              const dragSourceIndex = blocks.findIndex(b => b.id === draggedBlockId)
              return dragSourceIndex < blocks.length - 1
            })() && (
              <div className="h-1 bg-primary-500 rounded my-1 shadow-sm" />
            )}
          </div>

          {/* 파일 드래그 오버레이 */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-50 bg-opacity-95 border-2 border-dashed border-primary-400 rounded-lg z-10">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto text-primary-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-primary-700 font-medium">이미지를 여기에 놓으세요</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 도움말 */}
      <p className="text-xs text-gray-500">
        이미지: 드래그 또는 Ctrl+V로 붙여넣기 (최대 50MB) | 서식: 텍스트 선택 후 도구모음 버튼 클릭 | 블록 왼쪽 ⠿ 핸들로 순서 변경
      </p>
    </div>
  )
}

export default memo(MarkdownEditor)
