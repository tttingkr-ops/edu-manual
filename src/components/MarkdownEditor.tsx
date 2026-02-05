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

// 마크다운을 블록으로 파싱
const parseMarkdownToBlocks = (markdown: string): ContentBlock[] => {
  const blocks: ContentBlock[] = []
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g

  let lastIndex = 0
  let match
  let blockId = 0

  while ((match = imageRegex.exec(markdown)) !== null) {
    // 이미지 앞의 텍스트
    if (match.index > lastIndex) {
      const text = markdown.slice(lastIndex, match.index).trim()
      if (text) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'text',
          content: text,
        })
      }
    }

    // 이미지 블록
    blocks.push({
      id: `block-${blockId++}`,
      type: 'image',
      content: match[2], // URL
      alt: match[1] || '이미지',
    })

    lastIndex = match.index + match[0].length
  }

  // 마지막 텍스트
  if (lastIndex < markdown.length) {
    const text = markdown.slice(lastIndex).trim()
    if (text) {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'text',
        content: text,
      })
    }
  }

  // 블록이 없으면 빈 텍스트 블록 추가
  if (blocks.length === 0) {
    blocks.push({
      id: 'block-0',
      type: 'text',
      content: '',
    })
  }

  return blocks
}

// 블록을 마크다운으로 변환
const blocksToMarkdown = (blocks: ContentBlock[]): string => {
  return blocks.map(block => {
    if (block.type === 'image') {
      return `![${block.alt || '이미지'}](${block.content})`
    }
    return block.content
  }).join('\n\n')
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
  const dragCounterRef = useRef(0)
  const supabase = useMemo(() => createClient(), [])

  // 외부 value 변경 시 동기화
  useEffect(() => {
    if (!showCodeMode) {
      setBlocks(parseMarkdownToBlocks(value))
    }
    setCodeValue(value)
  }, [value, showCodeMode])

  // 블록 변경 시 마크다운으로 변환하여 부모에 알림
  const updateBlocks = useCallback((newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks)
    const markdown = blocksToMarkdown(newBlocks)
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

  // 이미지 추가 (블록 끝에)
  const addImageBlock = useCallback(async (file: File) => {
    const url = await uploadImage(file)
    if (url) {
      const newBlocks = [
        ...blocks,
        {
          id: `block-${Date.now()}`,
          type: 'image' as const,
          content: url,
          alt: file.name,
        },
        {
          id: `block-${Date.now() + 1}`,
          type: 'text' as const,
          content: '',
        },
      ]
      updateBlocks(newBlocks)
    }
  }, [blocks, uploadImage, updateBlocks])

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

  // 드래그 앤 드랍 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    for (const file of imageFiles) {
      await addImageBlock(file)
    }
  }, [addImageBlock])

  // 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))

    if (imageItems.length === 0) return

    e.preventDefault()

    for (const item of imageItems) {
      const file = item.getAsFile()
      if (file) {
        await addImageBlock(file)
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
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="p-4 space-y-4">
            {blocks.map((block, index) => (
              <div key={block.id}>
                {block.type === 'image' ? (
                  // 이미지 블록
                  <div className="relative group">
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
                  <textarea
                    value={block.content}
                    onChange={(e) => updateTextBlock(block.id, e.target.value)}
                    onPaste={handlePaste}
                    className="w-full px-0 py-2 border-0 focus:ring-0 resize-none text-gray-900 placeholder-gray-400"
                    rows={Math.max(3, block.content.split('\n').length)}
                    placeholder={index === 0 ? (placeholder || '내용을 입력하세요...') : '계속 작성하세요...'}
                  />
                )}
              </div>
            ))}
          </div>

          {/* 드래그 오버레이 */}
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
        이미지를 드래그하거나 Ctrl+V로 붙여넣을 수 있습니다. 코드 모드에서 마크다운을 직접 편집할 수 있습니다.
      </p>
    </div>
  )
}

export default memo(MarkdownEditor)
