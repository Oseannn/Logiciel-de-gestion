export function formatCurrency(
  amount: number,
  currency: string = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'XAF'
): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, ''))
}
