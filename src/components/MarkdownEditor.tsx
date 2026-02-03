// Created: 2026-02-03 10:30:00
// 마크다운 에디터 - 드래그 앤 드랍 이미지 업로드 지원
// Updated: 2026-02-03 - 성능 최적화 (debounce, 이미지 압축)
'use client'

import { useState, useRef, useCallback, useMemo, memo } from 'react'
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

      // 최대 너비 제한
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

// debounce 훅
function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    }) as T,
    [callback, delay]
  )
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
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [localValue, setLocalValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = useMemo(() => createClient(), [])

  // debounced onChange
  const debouncedOnChange = useDebounce(onChange, 150)

  // 로컬 값 변경 핸들러 (debounce 적용)
  const handleLocalChange = useCallback((newValue: string) => {
    setLocalValue(newValue)
    debouncedOnChange(newValue)
  }, [debouncedOnChange])

  // 이미지 업로드 처리 (압축 포함)
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    // 파일 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('JPG, PNG, GIF, WEBP 형식만 지원됩니다.')
      return null
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return null
    }

    setIsUploading(true)
    try {
      // 이미지 압축 (1200px, 80% 품질)
      const compressedBlob = await compressImage(file, 1200, 0.8)

      const fileExt = 'jpg' // 압축 후 항상 jpeg
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('education-images')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('education-images')
        .getPublicUrl(filePath)

      // 업로드된 이미지 목록에 추가
      setUploadedImages(prev => [...prev, { url: publicUrl, name: file.name }])

      // 콜백 호출
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
    onChange(newValue) // 즉시 반영 (이미지 삽입은 debounce 안 함)

    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }, [localValue, onChange])

  // 드래그 앤 드랍 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    for (const file of imageFiles) {
      const url = await uploadImage(file)
      if (url) {
        // 마크다운 이미지 형식으로 삽입
        insertAtCursor(`\n![${file.name}](${url})\n`)
      }
    }
  }, [uploadImage, insertAtCursor])

  // 붙여넣기 핸들러 (Ctrl+V로 이미지 붙여넣기)
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

    // input 초기화
    e.target.value = ''
  }, [uploadImage, insertAtCursor])

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-t-lg">
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
        <span className="text-xs text-gray-400">|</span>
        <span className="text-xs text-gray-500">
          이미지를 드래그하거나 Ctrl+V로 붙여넣을 수 있습니다
        </span>
        {isUploading && (
          <span className="flex items-center gap-1.5 text-xs text-primary-600 ml-auto">
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            업로드 중...
          </span>
        )}
      </div>

      {/* 에디터 영역 */}
      <div
        className={`relative transition-colors ${
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
          placeholder={placeholder}
        />

        {/* 드래그 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary-50 bg-opacity-90 border-2 border-dashed border-primary-400 rounded-lg">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-primary-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-primary-700 font-medium">이미지를 여기에 놓으세요</p>
            </div>
          </div>
        )}
      </div>

      {/* 업로드된 이미지 목록 */}
      {uploadedImages.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">
            업로드된 이미지 ({uploadedImages.length}개)
          </p>
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((img, index) => (
              <div
                key={index}
                className="group relative"
                title={img.name}
              >
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  className="w-16 h-16 object-cover rounded border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => insertAtCursor(`\n![${img.name}](${img.url})\n`)}
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity rounded"
                >
                  삽입
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            이미지 클릭 시 에디터에 삽입됩니다. 테스트 문제 생성 시 이 이미지들을 사용할 수 있습니다.
          </p>
        </div>
      )}

      {/* 마크다운 도움말 */}
      <details className="text-sm">
        <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
          마크다운 문법 도움말
        </summary>
        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-600 space-y-1">
          <p><code className="bg-gray-200 px-1 rounded"># 제목</code> - 큰 제목</p>
          <p><code className="bg-gray-200 px-1 rounded">## 소제목</code> - 중간 제목</p>
          <p><code className="bg-gray-200 px-1 rounded">**굵게**</code> - <strong>굵은 글씨</strong></p>
          <p><code className="bg-gray-200 px-1 rounded">*기울임*</code> - <em>기울임 글씨</em></p>
          <p><code className="bg-gray-200 px-1 rounded">- 항목</code> - 목록</p>
          <p><code className="bg-gray-200 px-1 rounded">![설명](URL)</code> - 이미지</p>
        </div>
      </details>
    </div>
  )
}

// memo로 감싸서 불필요한 리렌더링 방지
export default memo(MarkdownEditor)

// 업로드된 이미지 목록을 외부에서 접근하기 위한 타입
export type { UploadedImage }
