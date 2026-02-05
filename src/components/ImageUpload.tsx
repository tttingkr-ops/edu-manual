// Created: 2026-02-01 20:35:00
// Updated: 2026-02-03 - 성능 최적화 (이미지 압축, memo)
'use client'

import { useState, useRef, memo, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageUploadProps {
  onUpload: (url: string, path: string) => void
  maxSizeMB?: number
  bucket?: string
  folder?: string
  className?: string
}

// 폴더명 안전하게 변환 (한글/특수문자 제거)
const sanitizeFolderPath = (path: string): string => {
  // 한글 카테고리를 영문으로 매핑
  const categoryMap: Record<string, string> = {
    '남자_매니저_대화': 'male_manager_chat',
    '여자_매니저_대화': 'female_manager_chat',
    '여자_매니저_소개': 'female_manager_intro',
    '추가_서비스_규칙': 'additional_service_rules',
  }

  let sanitized = path
  for (const [korean, english] of Object.entries(categoryMap)) {
    sanitized = sanitized.replace(korean, english)
  }

  // 나머지 한글/특수문자는 제거하고 영문/숫자/언더스코어/슬래시만 유지
  return sanitized.replace(/[^a-zA-Z0-9_/\-]/g, '')
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

function ImageUpload({
  onUpload,
  maxSizeMB = 5,
  bucket = 'answer-images',
  folder = 'uploads',
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const processFile = async (file: File) => {
    setError(null)

    // 파일 크기 검증 (MB to bytes)
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setError(`파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`)
      return
    }

    // 이미지 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('JPG, PNG, GIF, WEBP 형식만 지원됩니다.')
      return
    }

    // 미리보기 생성
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    // 업로드 시작
    setUploading(true)
    try {
      // 이미지 압축 (1200px, 80% 품질)
      const compressedBlob = await compressImage(file, 1200, 0.8)

      const fileExt = 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const safeFolder = sanitizeFolderPath(folder)
      const filePath = `${safeFolder}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      onUpload(publicUrl, filePath)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || '업로드 중 오류가 발생했습니다.')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) processFile(file)
        break
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      processFile(file)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onUpload('', '')
  }

  return (
    <div className={className}>
      {!preview ? (
        <div
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          tabIndex={0}
          className="outline-none"
        >
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50'
          }`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-500">
                {uploading ? '업로드 중...' : '클릭, 붙여넣기(Ctrl+V) 또는 드래그하여 업로드'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                최대 {maxSizeMB}MB (JPG, PNG, GIF, WEBP)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </div>
      ) : (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-32 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

export default memo(ImageUpload)
