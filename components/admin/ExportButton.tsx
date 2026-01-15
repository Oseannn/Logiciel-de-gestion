'use client'

import { Icon } from '@/components/ui/Icon'

interface ExportButtonProps<T> {
  data: T[]
  headers: string[]
  formatRow: (item: T) => string[]
  filename: string
  label?: string
  variant?: 'primary' | 'success'
}

export function ExportButton<T>({
  data,
  headers,
  formatRow,
  filename,
  label = 'Exporter CSV',
  variant = 'success'
}: ExportButtonProps<T>) {
  const handleExport = () => {
    if (data.length === 0) {
      alert('Aucune donnée à exporter')
      return
    }

    // Format rows
    const rows = data.map(item => {
      const values = formatRow(item)
      return values.map(v => {
        const str = String(v)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    })

    // Combine with BOM for Excel UTF-8 recognition
    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-blue-600',
    success: 'bg-green-600 text-white hover:bg-green-700'
  }

  return (
    <button
      onClick={handleExport}
      className={`flex items-center px-4 py-2 rounded-lg transition-colors shadow-sm font-medium ${variantClasses[variant]}`}
    >
      <Icon name="download" className="mr-2 text-lg" />
      {label}
    </button>
  )
}
