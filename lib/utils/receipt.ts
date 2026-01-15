/**
 * RetailOS - Receipt Generation Utilities
 * Compatible with 80mm thermal paper
 */

import { formatCurrency } from './currency'

export interface ReceiptSale {
  id: string
  created_at: string
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  vendeuse_name?: string
  client_name?: string
  items: {
    name: string
    quantity: number
    price: number
    total: number
  }[]
  discount?: {
    type: 'percentage' | 'fixed'
    value: number
    reason?: string
  }
  subtotal?: number
}

export interface ReceiptConfig {
  storeName: string
  storeTagline: string
  storePhone?: string
  storeAddress?: string
  logoUrl?: string
  footerMessage: string
}

export const RECEIPT_CONFIG: ReceiptConfig = {
  paperWidth: 80,
  charsPerLine: 42,
  storeName: 'Ma Boutique',
  storeTagline: 'Votre Boutique Mode',
  logoUrl: '/logo.png', // Logo par défaut
  footerMessage: 'Merci de votre visite !\nConservez votre ticket.'
} as any

function padLeft(str: string, length: number): string {
  str = String(str)
  while (str.length < length) {
    str = ' ' + str
  }
  return str
}

function padRight(str: string, length: number): string {
  str = String(str)
  while (str.length < length) {
    str = str + ' '
  }
  return str.substring(0, length)
}

function centerText(str: string, length: number): string {
  str = String(str)
  const padding = Math.max(0, length - str.length)
  const leftPad = Math.floor(padding / 2)
  const rightPad = padding - leftPad
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad)
}

function separator(char: string = '-', width: number = 42): string {
  return char.repeat(width)
}

export function generateReceiptText(sale: ReceiptSale, config?: Partial<ReceiptConfig>): string {
  const receiptConfig = { ...RECEIPT_CONFIG, ...config }
  const lines: string[] = []
  const w = 42 // charsPerLine

  // Header
  lines.push(separator('=', w))
  lines.push(centerText(receiptConfig.storeName, w))
  lines.push(centerText(receiptConfig.storeTagline, w))
  
  // Ajouter téléphone et adresse si disponibles
  if (receiptConfig.storePhone) {
    lines.push(centerText(`Tél: ${receiptConfig.storePhone}`, w))
  }
  if (receiptConfig.storeAddress) {
    lines.push(centerText(receiptConfig.storeAddress, w))
  }
  
  lines.push(separator('-', w))

  // Sale info
  const saleDate = new Date(sale.created_at)
  const dateStr = saleDate.toLocaleDateString('fr-FR')
  const timeStr = saleDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  lines.push(`Date: ${dateStr}      Heure: ${timeStr}`)
  lines.push(`Ticket N°: ${sale.id.slice(-12)}`)
  if (sale.vendeuse_name) {
    lines.push(`Vendeuse: ${sale.vendeuse_name}`)
  }
  lines.push(`Client: ${sale.client_name || 'Client Passage'}`)
  lines.push(separator('=', w))

  // Items
  lines.push('')
  lines.push('ARTICLES')
  lines.push(separator('-', w))

  sale.items.forEach(item => {
    const productName = item.name.length > w ? item.name.substring(0, w - 3) + '...' : item.name
    lines.push(productName)

    const qtyPrice = `  ${item.quantity} x ${formatCurrency(item.price)}`
    const itemTotal = formatCurrency(item.total)
    const spacer = w - qtyPrice.length - itemTotal.length
    lines.push(qtyPrice + ' '.repeat(Math.max(1, spacer)) + itemTotal)
  })

  lines.push(separator('-', w))

  // Subtotal
  const subtotalLabel = 'SOUS-TOTAL'
  const subtotalValue = formatCurrency(sale.total)
  lines.push(padRight(subtotalLabel, w - subtotalValue.length) + subtotalValue)

  // Tax
  const taxLabel = 'TVA (0%)'
  const taxValue = formatCurrency(0)
  lines.push(padRight(taxLabel, w - taxValue.length) + taxValue)

  lines.push(separator('=', w))

  // Total
  const totalLabel = 'TOTAL'
  const totalValue = formatCurrency(sale.total)
  lines.push(padRight(totalLabel, w - totalValue.length) + totalValue)

  lines.push(separator('=', w))

  // Payment method
  const paymentMethods: Record<string, string> = {
    'cash': 'ESPÈCES',
    'card': 'CARTE BANCAIRE',
    'mobile': 'MOBILE MONEY'
  }
  const paymentMethod = paymentMethods[sale.payment_method] || sale.payment_method.toUpperCase()
  lines.push('')
  lines.push(`Mode de paiement: ${paymentMethod}`)

  // Footer
  lines.push('')
  receiptConfig.footerMessage.split('\n').forEach(line => {
    lines.push(centerText(line, w))
  })
  lines.push(separator('=', w))

  return lines.join('\n')
}

export function generateReceiptHTML(sale: ReceiptSale, config?: Partial<ReceiptConfig>): string {
  const receiptConfig = { ...RECEIPT_CONFIG, ...config }
  const receiptText = generateReceiptText(sale, receiptConfig)

  // Générer le HTML du logo si disponible
  const logoHtml = receiptConfig.logoUrl 
    ? `<div class="logo-container">
        <img src="${receiptConfig.logoUrl}" alt="${receiptConfig.storeName}" class="logo" onerror="this.style.display='none'" />
       </div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Ticket #${sale.id.slice(-8)}</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 0;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.3;
            width: 80mm;
            max-width: 80mm;
            padding: 3mm;
            background: white;
            color: black;
        }
        
        .logo-container {
            text-align: center;
            margin-bottom: 8px;
            padding: 5px 0;
        }
        
        .logo {
            max-width: 60mm;
            max-height: 25mm;
            height: auto;
            object-fit: contain;
        }
        
        .receipt-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 11px;
        }
        
        @media print {
            body {
                width: 80mm;
                max-width: 80mm;
                margin: 0;
                padding: 2mm;
            }
            
            .logo {
                max-width: 55mm;
                max-height: 20mm;
            }
            
            .no-print {
                display: none !important;
            }
        }
        
        @media screen {
            body {
                max-width: 320px;
                margin: 20px auto;
                padding: 15px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border-radius: 4px;
            }
        }
    </style>
</head>
<body>
    ${logoHtml}
    <div class="receipt-content">${escapeHtml(receiptText)}</div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

export function printReceipt(sale: ReceiptSale, config?: Partial<ReceiptConfig>): void {
  const receiptHTML = generateReceiptHTML(sale, config)
  const printWindow = window.open('', '_blank', 'width=350,height=600')

  if (!printWindow) {
    alert('Veuillez autoriser les pop-ups pour imprimer le ticket.')
    return
  }

  printWindow.document.write(receiptHTML)
  printWindow.document.close()

  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 250)
  }
}
