// Created: 2026-01-27 16:30:00
'use client'

interface ProgressBarProps {
  label: string
  current: number
  total: number
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'green' | 'orange' | 'red'
}

export default function ProgressBar({
  label,
  current,
  total,
  showPercentage = true,
  size = 'md',
  color = 'primary',
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }

  const colorClasses = {
    primary: 'bg-primary-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  }

  const bgColorClasses = {
    primary: 'bg-primary-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    red: 'bg-red-100',
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          {current} / {total}
          {showPercentage && (
            <span className="ml-2 font-medium text-gray-900">({percentage}%)</span>
          )}
        </span>
      </div>
      <div
        className={`w-full ${bgColorClasses[color]} rounded-full ${sizeClasses[size]} overflow-hidden`}
      >
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
