export type UserRole = 'admin' | 'manager' | 'vendeuse'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface AuthUser extends User {
  sessionStart?: string
}
