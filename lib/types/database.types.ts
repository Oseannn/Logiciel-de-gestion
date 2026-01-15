export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          full_name: string | null
          role: 'admin' | 'manager' | 'vendeuse'
          avatar_url: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          full_name?: string | null
          role: 'admin' | 'manager' | 'vendeuse'
          avatar_url?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'vendeuse'
          avatar_url?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          sku: string | null
          brand: string | null
          category: string
          price: number
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sku?: string | null
          brand?: string | null
          category: string
          price: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sku?: string | null
          brand?: string | null
          category?: string
          price?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          size: string
          color: string
          stock: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          size: string
          color: string
          stock?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          size?: string
          color?: string
          stock?: number
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
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
        Insert: {
          id?: string
          first_name: string
          last_name: string
          phone?: string | null
          email?: string | null
          type?: 'Regular' | 'VIP'
          total_spent?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          email?: string | null
          type?: 'Regular' | 'VIP'
          total_spent?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          vendeuse_id: string | null
          client_id: string | null
          total: number
          payment_method: 'cash' | 'card' | 'mobile'
          status: 'completed' | 'cancelled' | 'partially_refunded'
          created_at: string
        }
        Insert: {
          id?: string
          vendeuse_id?: string | null
          client_id?: string | null
          total: number
          payment_method: 'cash' | 'card' | 'mobile'
          status?: 'completed' | 'cancelled' | 'partially_refunded'
          created_at?: string
        }
        Update: {
          id?: string
          vendeuse_id?: string | null
          client_id?: string | null
          total?: number
          payment_method?: 'cash' | 'card' | 'mobile'
          status?: 'completed' | 'cancelled' | 'partially_refunded'
          created_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string | null
          variant_id: string | null
          quantity: number
          price: number
          total: number
        }
        Insert: {
          id?: string
          sale_id: string
          product_id?: string | null
          variant_id?: string | null
          quantity: number
          price: number
          total: number
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string | null
          variant_id?: string | null
          quantity?: number
          price?: number
          total?: number
        }
      }
      cash_register: {
        Row: {
          id: string
          vendeuse_id: string | null
          status: 'open' | 'closed'
          opened_at: string
          closed_at: string | null
          initial_amount: number
          final_amount: number | null
          expected_amount: number | null
          difference: number | null
          sales_total: number
          created_at: string
        }
        Insert: {
          id?: string
          vendeuse_id?: string | null
          status: 'open' | 'closed'
          opened_at: string
          closed_at?: string | null
          initial_amount: number
          final_amount?: number | null
          expected_amount?: number | null
          difference?: number | null
          sales_total?: number
          created_at?: string
        }
        Update: {
          id?: string
          vendeuse_id?: string | null
          status?: 'open' | 'closed'
          opened_at?: string
          closed_at?: string | null
          initial_amount?: number
          final_amount?: number | null
          expected_amount?: number | null
          difference?: number | null
          sales_total?: number
          created_at?: string
        }
      }
      cash_withdrawals: {
        Row: {
          id: string
          cash_register_id: string | null
          amount: number
          reason: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cash_register_id?: string | null
          amount: number
          reason: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cash_register_id?: string | null
          amount?: number
          reason?: string
          created_by?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          category: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          category: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          category?: string
          details?: Json | null
          created_at?: string
        }
      }
      refunds: {
        Row: {
          id: string
          sale_id: string | null
          refund_amount: number
          reason: string
          type: 'FULL' | 'PARTIAL' | null
          refunded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sale_id?: string | null
          refund_amount: number
          reason: string
          type?: 'FULL' | 'PARTIAL' | null
          refunded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string | null
          refund_amount?: number
          reason?: string
          type?: 'FULL' | 'PARTIAL' | null
          refunded_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
