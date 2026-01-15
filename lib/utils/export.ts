/**
 * Utilitaires d'export de données
 */

export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (data.length === 0) {
    alert('Aucune donnée à exporter')
    return
  }

  // Utiliser les clés du premier objet comme headers si non fournis
  const csvHeaders = headers || Object.keys(data[0])
  
  // Créer les lignes CSV
  const csvRows = [
    csvHeaders.join(';'), // Header row
    ...data.map(row => 
      csvHeaders.map(header => {
        const value = row[header]
        // Échapper les guillemets et entourer de guillemets si nécessaire
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(';')
    )
  ]

  // Créer le blob avec BOM pour Excel
  const BOM = '\uFEFF'
  const csvContent = BOM + csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // Télécharger
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function formatSalesForExport(sales: any[]) {
  return sales.map(sale => ({
    'ID': sale.id?.slice(-8) || '',
    'Date': new Date(sale.created_at).toLocaleDateString('fr-FR'),
    'Heure': new Date(sale.created_at).toLocaleTimeString('fr-FR'),
    'Client': sale.client ? `${sale.client.first_name} ${sale.client.last_name}` : 'Passage',
    'Articles': sale.sale_items?.length || 0,
    'Total': sale.total,
    'Paiement': sale.payment_method === 'cash' ? 'Espèces' : sale.payment_method === 'card' ? 'Carte' : 'Mobile',
    'Statut': sale.status === 'completed' ? 'Complété' : sale.status === 'cancelled' ? 'Annulé' : 'Remboursé',
    'Vendeuse': sale.vendeuse?.name || ''
  }))
}

export function formatClientsForExport(clients: any[]) {
  return clients.map(client => ({
    'Prénom': client.first_name,
    'Nom': client.last_name,
    'Téléphone': client.phone || '',
    'Email': client.email || '',
    'Type': client.type || 'Regular',
    'Total Dépensé': client.total_spent || 0,
    'Date Création': new Date(client.created_at).toLocaleDateString('fr-FR')
  }))
}

export function formatProductsForExport(products: any[]) {
  return products.map(product => ({
    'Nom': product.name,
    'SKU': product.sku || '',
    'Marque': product.brand || '',
    'Catégorie': product.category,
    'Prix': product.price,
    'Stock Total': product.variants?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0) || 0,
    'Actif': product.active ? 'Oui' : 'Non'
  }))
}
