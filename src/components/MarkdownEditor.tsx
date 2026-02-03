// Created: 2026-02-03 10:30:00
// 마크다운 에디터 - 드래그 앤 드랍 이미지 업로드 지원
// Updated: 2026-02-03 - 이미지 미리보기 개선, 드래그앤드랍 버그 수정
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

interface UploadedImage {
  url: string
  name: string
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

// 마크다운에서 이미지 URL 추출
const extractImagesFromMarkdown = (markdown: string): UploadedImage[] => {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const images: UploadedImage[] = []
  let match
  while ((match = regex.exec(markdown)) !== null) {
    images.push({ name: match[1] || '이미지', url: match[2] })
  }
  return images
}

function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 15,
  onImageUpload,
}: MarkdownEditorProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragCounterRef = useRef(0)
  const supabase = useMemo(() => createClient(), [])

  // 외부 value 변경 시 동기화
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // 마크다운에서 추출한 이미지 목록
  const embeddedImages = useMemo(() => extractImagesFromMarkdown(localValue), [localValue])

  // 로컬 값 변경 핸들러
  const handleLocalChange = useCallback((newValue: string) => {
    setLocalValue(newValue)
    onChange(newValue)
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

  // 커서 위치에 텍스트 삽입
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = localValue.substring(0, start) + text + localValue.substring(end)

    setLocalValue(newValue)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }, [localValue, onChange])

  // 드래그 앤 드랍 핸들러 (카운터로 정확한 감지)
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
      const url = await uploadImage(file)
      if (url) {
        insertAtCursor(`\n![${file.name}](${url})\n`)
      }
    }
  }, [uploadImage, insertAtCursor])

  // 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))

    if (imageItems.length === 0) return

    e.preventDefault()

    for (const item of imageItems) {
      const file = item.getAsFile()
      if (file) {
        const url = await uploadImage(file)
        if (url) {
          insertAtCursor(`\n![붙여넣은 이미지](${url})\n`)
        }
      }
    }
  }, [uploadImage, insertAtCursor])

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    for (const file of files) {
      const url = await uploadImage(file)
      if (url) {
        insertAtCursor(`\n![${file.name}](${url})\n`)
      }
    }

    e.target.value = ''
  }, [uploadImage, insertAtCursor])

  // 이미지 삭제 (마크다운에서 제거)
  const removeImage = useCallback((imageUrl: string) => {
    const regex = new RegExp(`\\n?!\\[[^\\]]*\\]\\(${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`, 'g')
    const newValue = localValue.replace(regex, '\n')
    setLocalValue(newValue)
    onChange(newValue)
  }, [localValue, onChange])

  // 마크다운을 HTML로 변환 (간단한 버전)
  const renderMarkdown = useCallback((md: string) => {
    let html = md
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4 border" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline">$1</a>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n/g, '<br />')
    return html
  }, [])

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
          onClick={() => setShowPreview(!showPreview)}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            showPreview
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          {showPreview ? '편집' : '미리보기'}
        </button>
      </div>

      {/* 에디터/미리보기 영역 */}
      {showPreview ? (
        <div
          className="w-full px-4 py-3 border border-gray-300 rounded-b-lg bg-white min-h-[300px] prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(localValue) || '<p class="text-gray-400">내용이 없습니다.</p>' }}
        />
      ) : (
        <div
          className={`relative transition-all ${
            isDragging ? 'ring-2 ring-primary-500 ring-offset-2' : ''
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => handleLocalChange(e.target.value)}
            onPaste={handlePaste}
            className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm resize-none"
            rows={rows}
            placeholder={placeholder || '내용을 입력하세요. 이미지를 드래그하거나 붙여넣기(Ctrl+V) 할 수 있습니다.'}
          />

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

      {/* 첨부된 이미지 갤러리 */}
      {embeddedImages.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-2">
            첨부된 이미지 ({embeddedImages.length}개)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {embeddedImages.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  className="w-full h-24 object-cover rounded-lg border border-blue-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.url)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="이미지 삭제"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 도움말 */}
      <p className="text-xs text-gray-500">
        이미지를 드래그하거나 Ctrl+V로 붙여넣을 수 있습니다. 미리보기 버튼으로 결과를 확인하세요.
      </p>
    </div>
  )
}

export default memo(MarkdownEditor)

export type { UploadedImage }
