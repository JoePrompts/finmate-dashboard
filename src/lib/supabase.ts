import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey)

if (!SUPABASE_CONFIGURED) {
  // Soft warning for local/dev without env vars. Calls will fail gracefully in UI.
  console.warn(
    '[FinMate] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are not set. The dashboard will render but data fetching will be disabled.'
  )
}

export const supabase = SUPABASE_CONFIGURED
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : createClient('http://invalid.local', 'invalid')

// Database types (you can generate these later with supabase gen types typescript)
export interface Expense {
  id: string
  amount: number
  currency: string
  merchant: string | null
  category: string
  payment_method: string | null
  description: string | null
  date: string
  created_at: string
  user_id: string | null
}

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  created_at: string
}
