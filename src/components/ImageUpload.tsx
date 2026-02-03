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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
      const filePath = `${folder}/${fileName}`

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
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-gray-50 transition-colors">
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
              {uploading ? '업로드 중...' : '클릭하여 이미지 업로드'}
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
