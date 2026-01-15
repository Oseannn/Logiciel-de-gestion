import { memo, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/Card'

interface KPICardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  iconBgColor?: string
}

export const KPICard = memo(function KPICard({ 
  title, 
  value, 
  icon, 
  trend,
  iconBgColor = 'bg-blue-50'
}: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${iconBgColor}`}>
            {icon}
          </div>
          {trend && (
            <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
              trend.isPositive 
                ? 'text-green-600 bg-green-50' 
                : 'text-red-600 bg-red-50'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        <h3 className="text-sm text-gray-500 font-medium">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  )
})
