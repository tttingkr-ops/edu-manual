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
  const dropTargetIndexRef = useRef<number | null>(null)
  const focusBlockIdRef = useRef<string | null>(null)
  const textareaRefsMap = useRef<Map<string, HTMLTextAreaElement>>(new Map())
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

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      alert('파일 크기는 10MB 이하여야 합니다.')
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

  // === 블록 순서 변경 (드래그 앤 드롭) ===
  const handleBlockDragStart = useCallback((e: React.DragEvent, blockId: string) => {
    isBlockDragRef.current = true
    const blockEl = (e.currentTarget as HTMLElement).closest('[data-block-id]') as HTMLElement
    if (blockEl) {
      e.dataTransfer.setDragImage(blockEl, 20, 20)
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/block-id', blockId)
    setDraggedBlockId(blockId)
  }, [])

  const handleBlockDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!draggedBlockId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const insertIndex = e.clientY < midY ? index : index + 1
    dropTargetIndexRef.current = insertIndex
    setDropTargetIndex(insertIndex)
  }, [draggedBlockId])

  const handleBlockDrop = useCallback(() => {
    const targetIndex = dropTargetIndexRef.current
    if (!draggedBlockId || targetIndex === null) return

    const sourceIndex = blocks.findIndex(b => b.id === draggedBlockId)
    if (sourceIndex < 0 || sourceIndex === targetIndex || sourceIndex + 1 === targetIndex) {
      setDraggedBlockId(null)
      setDropTargetIndex(null)
      isBlockDragRef.current = false
      return
    }

    const newBlocks = [...blocks]
    const [moved] = newBlocks.splice(sourceIndex, 1)
    const adjusted = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
    newBlocks.splice(adjusted, 0, moved)

    // 마지막 블록이 텍스트가 아니면 추가
    if (newBlocks[newBlocks.length - 1].type !== 'text') {
      newBlocks.push({
        id: `block-${Date.now()}`,
        type: 'text' as const,
        content: '',
      })
    }

    setDraggedBlockId(null)
    setDropTargetIndex(null)
    dropTargetIndexRef.current = null
    isBlockDragRef.current = false
    updateBlocks(newBlocks)
  }, [draggedBlockId, blocks, updateBlocks])

  const handleBlockDragEnd = useCallback(() => {
    setDraggedBlockId(null)
    setDropTargetIndex(null)
    dropTargetIndexRef.current = null
    isBlockDragRef.current = false
  }, [])

  // === 파일 드래그 앤 드랍 핸들러 (블록 리오더링 시 무시) ===
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBlockDragRef.current) return
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBlockDragRef.current) return
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    if (isBlockDragRef.current) return

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    for (const file of imageFiles) {
      await addImageBlock(file)
    }
  }, [addImageBlock])

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
      <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-t-lg">
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
          className={`relative border border-gray-300 rounded-b-lg bg-white min-h-[300px] transition-all ${
            isDragging ? 'ring-2 ring-primary-500 ring-offset-2' : ''
          }`}
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
        >
          <div className="p-4 space-y-1">
            {blocks.map((block, index) => (
              <div key={block.id}>
                {/* 드롭 위치 표시선 */}
                {dropTargetIndex === index && draggedBlockId && draggedBlockId !== block.id && (
                  <div className="h-0.5 bg-primary-500 rounded my-1" />
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

                {/* 블록 (드래그 핸들 + 콘텐츠) */}
                <div
                  data-block-id={block.id}
                  onDragOver={(e) => handleBlockDragOver(e, index)}
                  onDrop={(e) => {
                    if (!draggedBlockId) return
                    e.preventDefault()
                    e.stopPropagation()
                    handleBlockDrop()
                  }}
                  className={`flex items-start gap-1 group/block rounded transition-opacity ${
                    draggedBlockId === block.id ? 'opacity-30' : ''
                  }`}
                >
                  {/* 드래그 핸들 */}
                  <div
                    draggable
                    onDragStart={(e) => handleBlockDragStart(e, block.id)}
                    onDragEnd={handleBlockDragEnd}
                    className="flex-shrink-0 mt-2 px-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover/block:opacity-100 transition-opacity select-none"
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

                  {/* 블록 콘텐츠 */}
                  <div className="flex-1 min-w-0">
                    {block.type === 'image' ? (
                      // 이미지 블록
                      <div className="relative group my-1">
                        <img
                          src={block.content}
                          alt={block.alt || '이미지'}
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
            ))}

            {/* 맨 아래 드롭 영역 */}
            {draggedBlockId && (
              <div
                className="h-8"
                onDragOver={(e) => {
                  e.preventDefault()
                  dropTargetIndexRef.current = blocks.length
                  setDropTargetIndex(blocks.length)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleBlockDrop()
                }}
              >
                {dropTargetIndex === blocks.length && (
                  <div className="h-0.5 bg-primary-500 rounded" />
                )}
              </div>
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
        이미지: 드래그 또는 Ctrl+V로 붙여넣기 | 블록 왼쪽 ⠿ 핸들로 순서 변경 | 코드 모드에서 마크다운 직접 편집
      </p>
    </div>
  )
}

export default memo(MarkdownEditor)
