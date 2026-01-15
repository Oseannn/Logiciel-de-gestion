'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils/cn'

interface IconProps {
  name: string
  className?: string
  filled?: boolean
}

export const Icon = memo(function Icon({ name, className, filled }: IconProps) {
  return (
    <span 
      className={cn(
        'material-symbols-outlined',
        filled && 'filled',
        className
      )}
    >
      {name}
    </span>
  )
})
