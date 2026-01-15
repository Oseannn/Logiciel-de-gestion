export interface Client {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  type: 'Regular' | 'VIP'
  total_spent: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateClientData {
  first_name: string
  last_name: string
  phone?: string
  email?: string
  type?: 'Regular' | 'VIP'
  created_by: string
}
