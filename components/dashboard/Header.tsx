'use client'

import { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-lg border-b border-gray-200 flex items-center justify-between px-6 z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg lg:text-xl font-bold text-primary">{title}</h2>
          {subtitle && (
            <p className="text-xs text-gray-400 hidden lg:block">{subtitle}</p>
          )}
        </div>
        {action}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center bg-gray-100 rounded-lg px-3 py-1.5">
          <Icon name="calendar_today" className="text-gray-400 text-sm" />
          <span className="ml-2 text-xs font-medium text-gray-600 capitalize">{today}</span>
        </div>
      </div>
    </header>
  )
}
