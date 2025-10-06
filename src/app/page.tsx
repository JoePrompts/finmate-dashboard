'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { supabase, SUPABASE_CONFIGURED, type Expense } from "@/lib/supabase"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useTheme } from "@/app/providers"
import {
  RefreshCw,
  AlertCircle,
  Settings,
  Moon,
  Sun,
  Monitor,
  ArrowUpRight,
  PiggyBank,
  Wallet,
  Receipt,
  HeartPulse,
  ShoppingCart,
  Utensils,
  Car,
  Plane,
  Home,
  PlugZap,
  Film,
  Dumbbell,
  Landmark,
  Tag,
  CreditCard,
  CalendarDays,
} from "lucide-react"

export default function Dashboard() {
  type ExpenseRow = Expense & { entry_type?: string | null }
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const { setTheme } = useTheme()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [netWorth, setNetWorth] = useState(0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [expectedBudget, setExpectedBudget] = useState(0)
  const monthlyPlannedOutflow = Math.max(monthlyExpenses, expectedBudget)
  const monthlyAvailable = monthlyIncome - monthlyPlannedOutflow
  const budgetRemaining = Math.max(expectedBudget - monthlyExpenses, 0)
  const budgetOver = Math.max(monthlyExpenses - expectedBudget, 0)
  const monthlyAvailableCaption = (() => {
    if (expectedBudget <= 0) return 'Based on actual cash flow (income − expenses)'
    if (budgetOver > 0) return `Spending exceeds budget by $${budgetOver.toLocaleString()}`
    if (budgetRemaining > 0) return `Holding $${budgetRemaining.toLocaleString()} for planned budget`
    return 'Budget fully allocated'
  })()
  type AccountRow = {
    id: string | number
    name?: string | null
    starting_balance?: number | string | null
    balance?: number | string | null
    type?: string | null
    account_type?: string | null
    is_credit_card?: boolean | null
    currency?: string | null
  }
  type AccountDisplay = { id: string | number; name: string; amount: number; currency?: string }
  const [accounts, setAccounts] = useState<AccountDisplay[]>([])
  const [creditCards, setCreditCards] = useState<AccountDisplay[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  type BudgetDisplay = { id: string | number; name: string; amount: number; progressPct: number; paid: number; due?: string | null }
  const [budgetItems, setBudgetItems] = useState<BudgetDisplay[]>([])
  type GoalDisplay = {
    id: string
    name: string
    description?: string | null
    goalType: string
    targetAmount: number
    targetCurrency: string
    deadline?: string | null
    progressPct: number
    contributed: number
    status: string
  }
  const [goals, setGoals] = useState<GoalDisplay[]>([])
  const [goalsLoading, setGoalsLoading] = useState(true)

  const topBudgetItems = useMemo(() => {
    return budgetItems
      .slice()
      .sort((a, b) => {
        const paidDiff = (b.paid || 0) - (a.paid || 0)
        if (paidDiff !== 0) return paidDiff
        return (b.amount || 0) - (a.amount || 0)
      })
      .slice(0, 5)
  }, [budgetItems])

  // Global USD->COP FX for aggregations (shared with tooltip cache)
  const { data: usdCopRate } = useQuery({
    queryKey: ["fx", "USD", "COP"],
    queryFn: async () => {
      const res = await fetch('https://open.er-api.com/v6/latest/USD')
      if (!res.ok) throw new Error(`FX HTTP ${res.status}`)
      const json = await res.json()
      const cop = json?.rates?.COP
      if (typeof cop !== 'number') throw new Error('COP rate unavailable')
      return cop as number
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })

  const convertToCop = useCallback((value: number, currency?: string | null): number => {
    const amount = Number.isFinite(value) ? value : 0
    const code = (currency || 'COP').toString().toUpperCase()
    if (code === 'USD' && typeof usdCopRate === 'number') {
      return amount * usdCopRate
    }
    return amount
  }, [usdCopRate])

  // Load auth session once and cache userId for all queries
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null)
      setAuthReady(true)
    }).catch(() => setAuthReady(true))
  }, [])

  function getCategoryIcon(category: string) {
    if (category.includes('grocery') || category.includes('supermarket')) return ShoppingCart
    if (category.includes('food') || category.includes('dining') || category.includes('restaurant') || category.includes('coffee')) return Utensils
    if (category.includes('transport') || category.includes('uber') || category.includes('taxi') || category.includes('car')) return Car
    if (category.includes('travel') || category.includes('flight') || category.includes('air')) return Plane
    if (category.includes('rent') || category.includes('mortgage') || category.includes('home') || category.includes('housing')) return Home
    if (category.includes('utility') || category.includes('electric') || category.includes('power') || category.includes('internet')) return PlugZap
    if (category.includes('entertain') || category.includes('movie') || category.includes('cinema') || category.includes('tv') || category.includes('game')) return Film
    if (category.includes('fitness') || category.includes('gym')) return Dumbbell
    if (category.includes('salary') || category.includes('payroll') || category.includes('income')) return Landmark
    if (category.includes('shopping') || category.includes('retail')) return ShoppingCart
    return Tag
  }

  function getGoalIcon(goalType: string) {
    const normalized = (goalType || '').toLowerCase()
    return normalized === 'debt' ? CreditCard : PiggyBank
  }

  function UsdToCop({ amount }: { amount: number }) {
    const [open, setOpen] = useState(false)

    const { data: rate, isLoading, isError, error, refetch } = useQuery({
      queryKey: ["fx", "USD", "COP"],
      queryFn: async () => {
        console.log('[FX] Query: fetching USD->COP …')
        const res = await fetch('https://open.er-api.com/v6/latest/USD')
        console.log('[FX] Query: status', res.status)
        if (!res.ok) throw new Error(`FX HTTP ${res.status}`)
        const json = await res.json()
        console.log('[FX] Query: payload keys', Object.keys(json || {}))
        const cop = json?.rates?.COP
        if (typeof cop !== 'number') throw new Error('COP rate unavailable')
        return cop as number
      },
      enabled: open,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    })

    const copValue = typeof rate === 'number' ? amount * rate : null

    return (
      <Tooltip open={open} onOpenChange={(v)=>{ setOpen(v); if (v) refetch(); }}>
        <TooltipTrigger asChild>
          <span className="underline decoration-dotted underline-offset-2 cursor-default">USD</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="w-56 text-sm">
          {open && isLoading && <div className="text-muted-foreground">Loading FX…</div>}
          {open && isError && <div className="text-red-600">{(error as Error)?.message || 'FX fetch failed'}</div>}
          {open && !isLoading && !isError && typeof rate === 'number' && (
            <div className="space-y-1">
              <div className="font-medium">COP {copValue?.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">1 USD = {rate.toLocaleString()} COP</div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error && err.message) return err.message
    if (typeof err === 'object' && err !== null) {
      const rec = err as Record<string, unknown>
      const m = rec['message']
      if (typeof m === 'string') return m
      const ed = rec['error_description']
      if (typeof ed === 'string') return ed
      const st = rec['statusText']
      if (typeof st === 'string') return st
    }
    try {
      return JSON.stringify(err)
    } catch {
      return String(err ?? 'Unknown error')
    }
  }

  // Theme logic is managed by ThemeProvider (see src/app/providers.tsx)

  useEffect(() => {
    async function fetchExpenses() {
      // Skip fetching if Supabase is not configured
      if (!SUPABASE_CONFIGURED) {
        setErrorMsg('Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to fetch data.')
        setLoading(false)
        return
      }
      if (!authReady) return
      try {
        if (!userId) throw new Error('Not authenticated')

        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error

        setExpenses((data as ExpenseRow[]) || [])
      } catch (error: unknown) {
        const msg = getErrorMessage(error)
        setErrorMsg(`Error fetching expenses: ${msg}`)
        console.error('Error fetching expenses:', msg)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [authReady, userId])

  useEffect(() => {
    async function fetchMetrics() {
      if (!SUPABASE_CONFIGURED) return
      if (!authReady || !userId) return

      // Current month range (UTC)
      const start = new Date()
      start.setUTCDate(1)
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999))

      type ExpenseLite = {
        amount: number | string | null
        created_at: string
        entry_type?: string | null
        currency?: string | null
      }
      // removed unused AccountLite type per lint
      type BudgetRecord = Record<string, unknown>

      // Monthly Expenses and Income in parallel
      try {
        const [expRes, incRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, created_at, entry_type, currency')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .in('entry_type', ['expense', 'EXPENSE']),
          supabase
            .from('transactions')
            .select('amount, created_at, entry_type, currency')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .in('entry_type', ['income', 'INCOME'])
        ])
        if (expRes.error) throw expRes.error
        if (incRes.error) throw incRes.error
        const rowsExp = (expRes.data || []) as ExpenseLite[]
        const rowsInc = (incRes.data || []) as ExpenseLite[]
        const expenseSum = rowsExp.reduce((sum, row) => {
          const raw = Number(row.amount ?? 0)
          const amt = Number.isFinite(raw) ? Math.abs(raw) : 0
          return sum + convertToCop(amt, row.currency)
        }, 0)
        const incomeSum = rowsInc.reduce((sum, row) => {
          const raw = Number(row.amount ?? 0)
          const amt = Number.isFinite(raw) ? Math.abs(raw) : 0
          return sum + convertToCop(amt, row.currency)
        }, 0)
        setMonthlyExpenses(expenseSum)
        setMonthlyIncome(incomeSum)
      } catch (e) {
        console.warn('Monthly expenses/income fetch failed:', e)
      }

      // Expected Budget Expenses (from budget tables if populated)
      // Defaults to 0 if tables are empty or inaccessible
      try {
        // Attempt from budget_items first (scoped to current user)
        const { data: uDataB, error: uErrB } = await supabase.auth.getUser()
        if (uErrB || !uDataB?.user) throw new Error('Not authenticated')
        const userIdB = uDataB.user.id

        const { data: bi, error: biErr } = await supabase
          .from('budget_items')
          .select('*')
          .eq('user_id', userIdB)
          .limit(100)
        if (!biErr && bi && bi.length > 0) {
          // Try common numeric fields in priority order
          const numericKeys = ['planned_amount', 'amount', 'expected_amount'] as const
          const first = bi[0] as BudgetRecord
          const key = numericKeys.find(k => {
            const v = first[k as string]
            return typeof v === 'number' || typeof v === 'string'
          }) as (typeof numericKeys)[number] | undefined
          if (key) {
            const sum = (bi as BudgetRecord[]).reduce((s: number, r: BudgetRecord) => {
              const v = r[key as string]
              const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : 0
              return s + (Number.isFinite(Number(n)) ? Number(n) : 0)
            }, 0)
            setExpectedBudget(sum)
          }

          // Build display list for Monthly Budget card
          // Aggregate by category using stable category IDs when available
          const catIdKeys = ['category_id', 'categoryId', 'categoryID', 'categoryid', 'budget_category_id', 'budgetCategoryId'] as const
          const catLabelKeys = ['category_name', 'categoryName', 'category_label', 'label', 'title', 'group', 'type', 'name', 'category'] as const
          const dueKeys = ['due_date','due','deadline','dueDate','due_at'] as const
          const idToCat = new Map<string, string>()
          const plannedByCat = new Map<string, number>()
          const dueByCat = new Map<string, string>()
          const categoryLabels = new Map<string, string>()
          const categoryIdRawValues = new Set<string | number>()

          const normalizeCategoryQueryValue = (value: string | number): string | number => {
            if (typeof value === 'number') return value
            const trimmed = value.trim()
            if (/^-?\d+$/.test(trimmed)) {
              const num = Number(trimmed)
              if (Number.isFinite(num)) return num
            }
            return trimmed
          }

          const hydrateCategoryLabels = async () => {
            const rawValues = Array.from(categoryIdRawValues).filter((v) => v !== null && v !== undefined && v !== 'uncategorized')
            if (rawValues.length === 0) return
            const normalized = Array.from(new Set(rawValues.map((v) => normalizeCategoryQueryValue(v as string | number))))
            if (normalized.length === 0) return

            const sources = [
              { table: 'budget_categories', idColumns: ['id', 'category_id'] as const },
              { table: 'categories', idColumns: ['id', 'category_id'] as const },
            ] as const

            for (const { table, idColumns } of sources) {
              for (const column of idColumns) {
                try {
                  const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .in(column, normalized as (string | number)[])
                  if (error) {
                    console.warn(`[Budget] Category lookup failed via ${table}.${column}:`, (error as { message?: string }).message || error)
                    continue
                  }
                  if (!data || data.length === 0) continue
                  let matched = false
                  for (const row of data as Record<string, unknown>[]) {
                    const raw = row[column] ?? row['id'] ?? row['category_id']
                    if (raw == null) continue
                    const id = String(raw)
                    const labelCandidate = [row['name'], row['category_name'], row['label'], row['title']]
                      .map((val) => (typeof val === 'string' ? val.trim() : ''))
                      .find((val) => val.length > 0)
                    if (labelCandidate) {
                      categoryLabels.set(id, labelCandidate)
                      matched = true
                    }
                  }
                  if (matched) return
                } catch (lookupErr) {
                  console.warn(`[Budget] Category lookup error via ${table}.${column}:`, lookupErr)
                }
              }
            }
          }

          const resolveCategory = (record: BudgetRecord) => {
            let catId: string | null = null
            let rawValue: string | number | null = null
            for (const key of catIdKeys) {
              const value = record[key as string]
              if (typeof value === 'number' && Number.isFinite(value)) { rawValue = value; catId = String(value); break }
              if (typeof value === 'string' && value.trim()) { rawValue = value.trim(); catId = value.trim(); break }
            }
            let label: string | null = null
            for (const key of catLabelKeys) {
              const value = record[key as string]
              if (typeof value === 'string' && value.trim()) { label = value.trim(); break }
            }
            if (!catId && label) catId = label.toLowerCase()
            if (!catId) catId = 'uncategorized'
            if (!label) label = 'Uncategorized'
            return { catId, label, rawValue }
          }

          ;(bi as BudgetRecord[]).forEach((r) => {
            const amountKey = key || (['planned_amount','amount','expected_amount'].find(k => typeof r[k as string] === 'number' || typeof r[k as string] === 'string'))
            const rawAmount = amountKey ? r[amountKey as string] : 0
            const amount = typeof rawAmount === 'number' ? rawAmount : typeof rawAmount === 'string' ? parseFloat(rawAmount) : 0
            const rawId = r['id'] as unknown
            const idStr = rawId == null ? null : String(rawId)

            const { catId, label: catLabel, rawValue: rawCatValue } = resolveCategory(r)
            if (idStr) idToCat.set(idStr, catId)
            const existingLabel = categoryLabels.get(catId)
            if ((!existingLabel || existingLabel === 'Uncategorized') && catLabel) {
              categoryLabels.set(catId, catLabel)
            }
            if (rawCatValue !== null && rawCatValue !== undefined) {
              categoryIdRawValues.add(rawCatValue)
            }
            plannedByCat.set(catId, (plannedByCat.get(catId) || 0) + (Number.isFinite(amount) ? Number(amount) : 0))

            const dueKey = dueKeys.find(k => typeof r[k as string] === 'string') as (typeof dueKeys)[number] | undefined
            const due = dueKey ? (r[dueKey as string] as string) : null
            if (due) {
              const prev = dueByCat.get(catId)
              if (!prev || (Date.parse(due) || Infinity) < (Date.parse(prev) || Infinity)) {
                dueByCat.set(catId, due)
              }
            }
          })
          await hydrateCategoryLabels()

          // Compute per-item paid sums from budget_payments (this month)
          try {
            const start = new Date()
            start.setUTCDate(1)
            start.setUTCHours(0, 0, 0, 0)
            const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999))

            const { data: pays, error: payErr } = await supabase
              .from('budget_payments')
              .select('budget_item_id, amount, date, user_id, currency')
              .eq('user_id', userIdB)
              .gte('date', start.toISOString())
              .lte('date', end.toISOString())
              .limit(1000)
            if (payErr) throw payErr

            const amtKeys = ['amount'] as const
            const sumByItem = new Map<string, number>()
            for (const row of (pays || []) as Record<string, unknown>[]) {
              // Month filter using `date` column when present
              const recDate = row['date']
              if (typeof recDate === 'string') {
                const ts = Date.parse(recDate)
                if (!Number.isFinite(ts) || ts < start.getTime() || ts > end.getTime()) continue
              }
              const v = row['budget_item_id'] as unknown
              const itemRef = v == null ? null : String(v)
              if (!itemRef) continue
              let paid = 0
              for (const k of amtKeys) {
                const v = row[k as string]
                if (typeof v === 'number') { paid = v; break }
                if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) { paid = Number(v); break }
              }
              const currency = typeof row['currency'] === 'string' ? row['currency'] : undefined
              const normalizedPaid = Number.isFinite(paid) ? convertToCop(Math.abs(paid), currency) : 0
              sumByItem.set(itemRef, (sumByItem.get(itemRef) || 0) + normalizedPaid)
            }

            // Sum payments by category using item->category mapping
            const paidByCat = new Map<string, number>()
            for (const [itemId, catId] of idToCat.entries()) {
              const paid = sumByItem.get(itemId) || 0
              if (!paid) continue
              paidByCat.set(catId, (paidByCat.get(catId) || 0) + paid)
            }

            const withProgress: BudgetDisplay[] = Array.from(plannedByCat.entries()).map(([catId, amt]) => {
              const paid = paidByCat.get(catId) || 0
              const progressPct = amt > 0 ? (paid / amt) * 100 : 0
              const due = dueByCat.get(catId) ?? null
              const label = categoryLabels.get(catId) || 'Uncategorized'
              return { id: catId, name: label, amount: amt, progressPct, paid, due }
            })
            // Sort: by amount paid desc, then by total amount desc
            withProgress.sort((a, b) => {
              const paidDiff = (b.paid || 0) - (a.paid || 0)
              if (paidDiff !== 0) return paidDiff
              return (b.amount || 0) - (a.amount || 0)
            })
            setBudgetItems(withProgress)
          } catch (e) {
            console.warn('Budget payments fetch failed:', e)
            // If payments fetch fails, still show items without progress
            const cats: BudgetDisplay[] = Array.from(plannedByCat.entries()).map(([catId, amt]) => {
              const label = categoryLabels.get(catId) || 'Uncategorized'
              return { id: catId, name: label, amount: amt, progressPct: 0, paid: 0, due: dueByCat.get(catId) ?? null }
            })
            // Sort by amount desc as fallback
            cats.sort((a, b) => (b.amount || 0) - (a.amount || 0))
            setBudgetItems(cats)
          }
        } else {
          // Fallback to budgets
          const { data: b, error: bErr } = await supabase
            .from('budgets')
            .select('*')
            .limit(100)
          if (!bErr && b && b.length > 0) {
            const numericKeys = ['planned_amount', 'amount', 'expected_amount'] as const
            const first = b[0] as BudgetRecord
            const key = numericKeys.find(k => {
              const v = first[k as string]
              return typeof v === 'number' || typeof v === 'string'
            }) as (typeof numericKeys)[number] | undefined
            if (key) {
              const sum = (b as BudgetRecord[]).reduce((s: number, r: BudgetRecord) => {
                const v = r[key as string]
                const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : 0
                return s + (Number.isFinite(Number(n)) ? Number(n) : 0)
              }, 0)
              setExpectedBudget(sum)
            }
          }
          // If no budget_items, leave Monthly Budget card empty for now
        }
      } catch (e) {
        console.warn('Budget fetch failed:', e)
      }

      // Net Worth (sum of accounts.starting_balance as a baseline) and Accounts lists
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', userId)
        if (error) throw error
        const rows = (data || []) as unknown as AccountRow[]

        // Normalize numeric values that may come as strings with formatting (e.g. "USD 1,234.56")
        const parseAmount = (input: unknown): number => {
          if (typeof input === 'number') return Number.isFinite(input) ? input : Number.NaN
          if (typeof input === 'string') {
            const cleaned = input.replace(/,/g, '').replace(/[^0-9.\-]/g, '')
            if (!cleaned || cleaned === '-' || cleaned === '.') return Number.NaN
            const parsed = Number(cleaned)
            return Number.isFinite(parsed) ? parsed : Number.NaN
          }
          return Number.NaN
        }

        // Helper to pick the best numeric field per record
        const pickAmount = (rec: Record<string, unknown>, keys: string[]): number => {
          for (const k of keys) {
            if (!(k in rec)) continue
            const parsed = parseAmount(rec[k])
            if (!Number.isNaN(parsed)) return parsed
          }
          return 0
        }

        // Prepare non-credit accounts base list using starting balance only
        const accountsBase: AccountDisplay[] = rows
          .filter((r) => {
            const t = String(r.type ?? r.account_type ?? '').toLowerCase()
            const byFlag = r.is_credit_card === true
            const byType = t.includes('credit') || t.includes('card')
            const byName = String(r.name ?? '').toLowerCase().includes('card')
            return !(byFlag || byType || byName)
          })
          .map((r) => {
            const start = pickAmount(r as unknown as Record<string, unknown>, [
              'starting_balance',
            ])
            return {
              id: r.id,
              name: (r.name as string) || 'Account',
              amount: start,
              currency: r.currency ?? undefined,
            }
          })

        let ccList: AccountDisplay[] = rows
          .filter((r) => {
            const t = String(r.type ?? r.account_type ?? '').toLowerCase()
            const byFlag = r.is_credit_card === true
            const byType = t.includes('credit') || t.includes('card')
            const byName = String(r.name ?? '').toLowerCase().includes('card')
            return byFlag || byType || byName
          })
          .map((r) => {
            const amount = pickAmount(r as unknown as Record<string, unknown>, [
              'current_balance',
              'statement_balance',
              'outstanding_balance',
              'due_amount',
              'balance',
              'starting_balance',
            ])
            return {
              id: r.id,
              name: (r.name as string) || 'Credit Card',
              amount,
              currency: r.currency ?? undefined,
            }
          })

        let accountsForNetWorth: AccountDisplay[] = accountsBase

        // Compute credit card balances strictly from transactions converted to COP
        try {
          type TxRow = {
            payment_method: string | null
            account?: string | null
            amount: number | string | null
            entry_type?: string | null
            currency?: string | null
          }
          const { data: txs, error: txErr } = await supabase
            .from('transactions')
            .select('payment_method, account, amount, entry_type, currency')
            .eq('user_id', userId)
          if (txErr) throw txErr
          const normalizeLabel = (value: unknown): string => {
            if (typeof value !== 'string') return ''
            const trimmed = value.trim().toLowerCase()
            return trimmed.replace(/\s+/g, ' ').trim()
          }
          const normalizedSumByLabelCOP = new Map<string, number>()
          const sumByLabelByCurrency = new Map<string, Map<string, number>>()
          for (const r of (txs || []) as TxRow[]) {
            const val = Number(r.amount ?? 0) || 0
            const et = (r.entry_type || '').toString().toLowerCase()
            const signed = et === 'income' ? Math.abs(val) : et === 'expense' ? -Math.abs(val) : val
            const cur = (r.currency || 'COP').toString().toUpperCase()
            const toCop = cur === 'USD' && typeof usdCopRate === 'number' ? signed * usdCopRate : signed
            const labels = new Set<string>()
            const pmLabel = normalizeLabel(r.payment_method)
            const accountLabel = normalizeLabel(r.account)
            if (pmLabel) labels.add(pmLabel)
            if (accountLabel) labels.add(accountLabel)
            if (labels.size === 0) continue
            for (const label of labels) {
              normalizedSumByLabelCOP.set(label, (normalizedSumByLabelCOP.get(label) || 0) + toCop)
              if (!sumByLabelByCurrency.has(label)) sumByLabelByCurrency.set(label, new Map<string, number>())
              const curMap = sumByLabelByCurrency.get(label)!
              curMap.set(cur, (curMap.get(cur) || 0) + signed)
            }
          }

          const normalizeAccountName = (value: string): string => value.toLowerCase().trim().replace(/\s+/g, ' ')

          // Apply transaction sums to non-credit accounts in their own currency
          const accountsWithTx: AccountDisplay[] = accountsBase.map((acct) => {
            const key = normalizeAccountName(acct.name)
            const code = (acct.currency || 'USD').toUpperCase()
            let txTotal = 0
            for (const [label, mapByCur] of sumByLabelByCurrency.entries()) {
              if (label.includes(key) || key.includes(label)) {
                txTotal += mapByCur.get(code) || 0
              }
            }
            return { ...acct, amount: acct.amount + txTotal }
          })
          accountsForNetWorth = accountsWithTx

          // Match by includes both ways to handle naming differences
          ccList = ccList.map((cc) => {
            const ccKey = normalizeAccountName(cc.name)
            let txTotalCop = 0
            let matched = false
            for (const [label, total] of normalizedSumByLabelCOP.entries()) {
              if (label.includes(ccKey) || ccKey.includes(label)) {
                txTotalCop += total
                matched = true
              }
            }
            // Prefer transactions sum when we have matches; otherwise fallback to account balance converted to COP
            if (matched) {
              return { ...cc, amount: txTotalCop, currency: 'COP' }
            }
            const fallbackCop = convertToCop(cc.amount, cc.currency)
            return { ...cc, amount: fallbackCop, currency: 'COP' }
          })
        } catch (txe) {
          console.warn('Credit card transaction sum failed:', txe)
          accountsForNetWorth = accountsBase
        }

        const sortedAccounts = [...accountsForNetWorth].sort((a, b) => {
          const diff = convertToCop(b.amount, b.currency) - convertToCop(a.amount, a.currency)
          if (diff !== 0) return diff
          return String(b.name || '').localeCompare(String(a.name || ''))
        })
        setAccounts(sortedAccounts)

        const sortedCreditCards = [...ccList].sort((a, b) => {
          const diff = convertToCop(b.amount, b.currency) - convertToCop(a.amount, a.currency)
          if (diff !== 0) return diff
          return String(b.name || '').localeCompare(String(a.name || ''))
        })
        setCreditCards(sortedCreditCards)
      } catch (e) {
        console.warn('Net worth fetch failed:', e)
      }
    }

    fetchMetrics()
  }, [authReady, userId, usdCopRate, convertToCop])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setNetWorth(0)
      return
    }
    if (!accounts || accounts.length === 0) {
      setNetWorth(0)
      return
    }

    const totalNetWorth = accounts.reduce((sum, acct) => sum + convertToCop(acct.amount, acct.currency), 0)
    setNetWorth(Number.isFinite(totalNetWorth) ? totalNetWorth : 0)
  }, [accounts, usdCopRate, convertToCop])

  useEffect(() => {
    async function fetchGoals() {
      if (!SUPABASE_CONFIGURED) {
        setGoals([])
        setGoalsLoading(false)
        return
      }
      if (!authReady) return
      if (!userId) {
        setGoals([])
        setGoalsLoading(false)
        return
      }

      try {
        setGoalsLoading(true)
        type GoalRow = {
          id: string
          name: string | null
          description: string | null
          goal_type: string | null
          target_amount: number | string | null
          base_currency: string | null
          deadline: string | null
          status: string | null
          goal_contributions?: { amount: number | string | null; currency?: string | null }[] | null
        }
        const { data, error } = await supabase
          .from('goals')
          .select(
            `id, name, description, goal_type, target_amount, base_currency, deadline, status, created_at, goal_contributions ( amount, currency )`
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (error) throw error

        const normalized: GoalDisplay[] = (data as GoalRow[] | null || []).map((row) => {
          const targetCurrency = (row.base_currency || 'COP').toUpperCase()
          const contributionsRaw = Array.isArray(row.goal_contributions)
            ? row.goal_contributions.reduce((sum, contrib) => {
                const raw = contrib?.amount
                const contribCurrency = (contrib?.currency || '').toString().toUpperCase()
                if (contribCurrency && contribCurrency !== targetCurrency) return sum
                if (typeof raw === 'number') return sum + raw
                if (typeof raw === 'string') {
                  const parsed = parseFloat(raw)
                  return Number.isFinite(parsed) ? sum + parsed : sum
                }
                return sum
              }, 0)
            : 0
          const contributions = Number.isFinite(contributionsRaw) ? contributionsRaw : 0
          const contributionsClamped = contributions >= 0 ? contributions : 0
          const goalType = (row.goal_type || 'saving').toString().toLowerCase()
          const status = (row.status || 'active').toString().toLowerCase()
          const targetRaw = row.target_amount
          const target = typeof targetRaw === 'number'
            ? targetRaw
            : typeof targetRaw === 'string'
              ? parseFloat(targetRaw)
              : 0
          const targetAbs = Number.isFinite(target) ? Math.abs(target) : 0
          const progressPct = targetAbs > 0 ? Math.min(100, Math.max(0, (contributionsClamped / targetAbs) * 100)) : 0
          return {
            id: row.id,
            name: row.name || 'Goal',
            description: row.description,
            goalType,
            targetAmount: targetAbs,
            targetCurrency,
            deadline: row.deadline,
            progressPct,
            contributed: contributionsClamped,
            status,
          }
        })

        setGoals(normalized)
      } catch (error) {
        console.error('Error fetching goals:', error)
        setGoals([])
      } finally {
        setGoalsLoading(false)
      }
    }

    fetchGoals()
  }, [authReady, userId])


  if (loading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-background px-4 md:px-6 sticky top-0">
          <div className="flex items-center gap-2 px-0 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="ml-auto h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-20 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="ml-auto h-4 w-12" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-20" />
              </CardHeader>
              <CardContent className="grid gap-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="grid gap-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="ml-auto h-4 w-12" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-background px-4 md:px-6 sticky top-0">
        <div className="flex w-full items-center gap-4 md:gap-2 lg:gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
            <div className="pl-0 text-sm font-medium">Dashboard</div>
          </div>
          <Button className="ml-auto" variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to fetch expenses</AlertTitle>
            <AlertDescription>
              {errorMsg}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card x-chunk="dashboard-01-chunk-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Net Worth</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${netWorth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Sum of account balances</p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Monthly Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${monthlyExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Monthly Available</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${monthlyAvailable.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{monthlyAvailableCaption}</p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finance Health Monitor</CardTitle>
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent></CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card x-chunk="dashboard-01-chunk-4">
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest transactions from the FinMate bot.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm" x-chunk="dashboard-02-chunk-1">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      You have no transactions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You can start tracking as soon as you send your first message to the bot.
                    </p>
                    <Button className="mt-4">Learn More</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {expenses.slice(0, 5).map((tx) => {
                    const type = String(tx.entry_type || "").toLowerCase()
                    const isIncome = type === 'income'
                    const isExpense = type === 'expense'
                    const amount = Number(tx.amount)
                    const sign = isIncome ? '+' : isExpense ? '-' : amount < 0 ? '-' : ''
                    const absAmount = Math.abs(amount)
                    const currency = tx.currency || 'USD'

                    const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: '$', CAD: '$' }
                    const symbol = currencySymbols[currency.toUpperCase()] || '$'

                    const category = String(tx.category || '').toLowerCase()
                    const Icon = getCategoryIcon(category)
                    const when = tx.date || tx.created_at
                    const date = when ? new Date(when) : null
                    const dateLabel = date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

                    return (
                      <div key={tx.id} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium leading-none">{tx.merchant || 'Unknown merchant'}</span>
                          <span className="text-xs text-muted-foreground">{dateLabel}</span>
                        </div>
                        <div
                          className={cn("ml-auto text-sm font-medium", isIncome && "text-emerald-600")}
                          style={
                            (isExpense || (!isIncome && sign === '-'))
                              ? { color: 'rgb(248 113 113 / var(--tw-text-opacity, 1))' }
                              : undefined
                          }
                        >
                          {sign}{symbol}{absAmount.toLocaleString()}{" "}
                          {currency.toUpperCase() === 'USD' ? (
                            <UsdToCop amount={absAmount} />
                          ) : (
                            <span>{currency.toUpperCase()}</span>
                          )}
                          <span className="ml-1">{isIncome ? '↗' : (isExpense || (!isIncome && sign === '-')) ? '↘' : ''}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* View all button moved to bottom, full width with subtle hover animation */}
              <Button asChild className="w-full mt-4 group transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
                <Link href="/transactions" className="flex items-center justify-center gap-2">
                  <span>View All</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-6">
            <CardHeader>
              <CardTitle>Account Balances</CardTitle>
              <CardDescription>Your current account balances across institutions.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {accounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No accounts found.</div>
              ) : (
                accounts.map((acct) => {
                  const symbol = '$'
                  const code = (acct.currency || 'USD').toUpperCase()
                  return (
                    <div key={acct.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div className="grid gap-1">
                        <div className="text-sm font-medium leading-none">{acct.name}</div>
                        <span className="text-xs text-muted-foreground">Currency: {code}</span>
                      </div>
                      <div className="ml-auto text-sm font-medium">
                        {symbol}{acct.amount.toLocaleString()} {" "}
                        {code === 'USD' || acct.name.toLowerCase().includes('astropay') ? (
                          <UsdToCop amount={acct.amount} />
                        ) : (
                          <span>{code}</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-7">
            <CardHeader>
              <CardTitle>Credit Cards</CardTitle>
              <CardDescription>Your credit card debt totals (in COP).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {creditCards.length === 0 ? (
                <div className="text-sm text-muted-foreground">No credit cards found.</div>
              ) : (
                creditCards.map((cc) => {
                  // Always show debt in COP, negative with $ symbol (no red color)
                  const absAmount = Math.abs(cc.amount || 0)
                  return (
                    <div key={cc.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div className="grid gap-1">
                        <div className="text-sm font-medium leading-none">{cc.name}</div>
                        <span className="text-xs text-muted-foreground">Debt (COP)</span>
                      </div>
                      <div className="ml-auto text-sm font-medium">
                        -${absAmount.toLocaleString()} COP
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
        {/* Third row: Monthly Budget + Goals/Investments */}
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card x-chunk="dashboard-01-chunk-8">
            <CardHeader>
              <CardTitle>Monthly Budget</CardTitle>
              <CardDescription>Plan and track this month&apos;s budget.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {budgetItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No budget items found.</div>
                ) : (
                  topBudgetItems.map((bi) => {
                      const pct = Math.max(0, bi.progressPct || 0)
                      const barValue = Math.min(100, pct)
                      const over = pct >= 100
                      const indicatorClass = over ? 'bg-red-500' : undefined
                      const dueLabel = bi.due ? (() => { const d = new Date(bi.due as string); return isNaN(d.getTime()) ? bi.due : d.toLocaleDateString() })() : null
                    const cat = String(bi.name || '').toLowerCase()
                    const Icon = getCategoryIcon(cat)
                    return (
                      <div key={bi.id} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="text-sm font-medium leading-none truncate">
                            {bi.name}
                          </div>
                          <div className="ml-auto text-sm font-medium">
                            ${bi.amount.toLocaleString()}
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 cursor-default">
                              <Progress value={barValue} className="h-2 flex-1" indicatorClassName={indicatorClass} />
                              <div className="w-12 text-right text-xs font-medium text-foreground">{Math.round(pct)}%</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center" className="text-xs">
                            <div>
                              Paid: ${ (bi.paid ?? 0).toLocaleString() } of ${ bi.amount.toLocaleString() }
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <div className="">{dueLabel ? `Due: ${dueLabel}` : ''}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <Button asChild className="w-full mt-4 group transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
                <Link href="/budget" className="flex items-center justify-center gap-2">
                  <span>View All</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
                <CardDescription>Track progress toward savings and debt targets.</CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                {!SUPABASE_CONFIGURED ? (
                  <div className="text-sm text-muted-foreground">Configure Supabase environment variables to load goals.</div>
                ) : (!authReady || goalsLoading) ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="space-y-2.5 rounded-lg border bg-muted/10 p-3">
                        <div className="flex items-center gap-2.5">
                          <Skeleton className="h-9 w-9 rounded-md" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        </div>
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-3 w-28" />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Skeleton className="h-3 w-3 rounded" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : goals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No goals yet. Create your first savings or debt goal to see progress here.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {goals.slice(0, 3).map((goal) => {
                      const Icon = getGoalIcon(goal.goalType)
                      const deadlineLabel = goal.deadline
                        ? (() => {
                            const parsed = new Date(goal.deadline as string)
                            if (Number.isNaN(parsed.getTime())) return 'Deadline pending'
                            return parsed.toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          })()
                        : 'No deadline set'
                      const targetLabel = `${goal.targetCurrency} ${goal.targetAmount.toLocaleString()}`
                      return (
                        <div key={goal.id} className="space-y-2.5 rounded-lg border bg-card/70 p-3 shadow-sm">
                          <div className="flex items-start gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="text-sm font-semibold leading-tight text-foreground">{goal.name}</div>
                              <div className="text-xs text-muted-foreground whitespace-pre-line leading-snug">
                                {goal.description ? goal.description : 'No description provided.'}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-1 cursor-default">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                                    <span>Progress</span>
                                    <span className="text-foreground">{Math.round(goal.progressPct)}%</span>
                                  </div>
                                  <Progress value={goal.progressPct} className="h-1.5" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center" className="text-xs">
                                <div className="space-y-1 text-left">
                                  <div className="font-medium text-foreground">Collected {`${goal.targetCurrency} ${goal.contributed.toLocaleString()}`}</div>
                                  <div className="text-muted-foreground">Goal {targetLabel}</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Target amount</span>
                              <span>{targetLabel}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>{deadlineLabel === 'No deadline set' ? 'No deadline set' : `Target: ${deadlineLabel}`}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle>Investments</CardTitle>
                <CardDescription>Monitor investment performance here soon.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-6">
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Investment insights coming soon.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Moved FinMate Bot Status to the bottom */}
        <div className="grid gap-4 md:gap-8 mt-4">
          <Card x-chunk="dashboard-01-chunk-5">
            <CardHeader>
              <CardTitle>FinMate Bot Status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Online</span>
                  </div>
                </div>
                <Badge variant="secondary">Live</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium leading-none mb-1">Server Status</p>
                  <p className="text-sm text-muted-foreground">finmate-bot.onrender.com</p>
                </div>
                <div>
                  <p className="text-sm font-medium leading-none mb-1">Database</p>
                  <p className="text-sm text-muted-foreground">Connected • Supabase</p>
                </div>
                <div>
                  <p className="text-sm font-medium leading-none mb-1">Last Sync</p>
                  <p className="text-sm text-muted-foreground">Just now</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">📱 Send messages to your Telegram bot for real-time expense tracking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
