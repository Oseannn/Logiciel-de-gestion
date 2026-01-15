import { format, formatDistance, formatRelative } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  return format(new Date(date), formatStr, { locale: fr })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'PPP à HH:mm', { locale: fr })
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm', { locale: fr })
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistance(new Date(date), new Date(), {
    addSuffix: true,
    locale: fr,
  })
}

export function formatRelativeDate(date: string | Date): string {
  return formatRelative(new Date(date), new Date(), { locale: fr })
}
