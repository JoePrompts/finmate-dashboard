'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { supabase, SUPABASE_CONFIGURED, type Expense } from "@/lib/supabase"
import { useEffect, useState } from "react"
import {
  RefreshCw,
  Activity,
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
} from "lucide-react"

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [netWorth, setNetWorth] = useState(0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [expectedBudget, setExpectedBudget] = useState(0)
  const monthlyAvailable = monthlyIncome - monthlyExpenses - expectedBudget

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

  useEffect(() => {
    // Apply theme
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // System theme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      if (mediaQuery.matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  useEffect(() => {
    async function fetchExpenses() {
      // Skip fetching if Supabase is not configured
      if (!SUPABASE_CONFIGURED) {
        setErrorMsg('Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to fetch data.')
        setLoading(false)
        return
      }
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error

        setExpenses(data || [])
      } catch (error: unknown) {
        const msg = getErrorMessage(error)
        setErrorMsg(`Error fetching expenses: ${msg}`)
        console.error('Error fetching expenses:', msg)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [])

  useEffect(() => {
    async function fetchMetrics() {
      if (!SUPABASE_CONFIGURED) return

      // Current month range (UTC)
      const start = new Date()
      start.setUTCDate(1)
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999))

      type ExpenseLite = {
        amount: number | string | null
        created_at: string
        entry_type?: string | null
      }
      type AccountLite = { starting_balance: number | string | null }
      type BudgetRecord = Record<string, unknown>

      // Monthly Expenses (entry_type = 'expense')
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('amount, created_at, entry_type')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .in('entry_type', ['expense', 'EXPENSE'])
        if (error) throw error
        const rows = (data || []) as ExpenseLite[]
        const sum = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
        setMonthlyExpenses(sum)
      } catch (e) {
        console.warn('Monthly expenses fetch failed:', e)
      }

      // Monthly Income (entry_type = 'income')
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('amount, created_at, entry_type')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .in('entry_type', ['income', 'INCOME'])
        if (error) throw error
        const rows = (data || []) as ExpenseLite[]
        const sum = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
        setMonthlyIncome(sum)
      } catch (e) {
        console.warn('Monthly income fetch failed:', e)
      }

      // Expected Budget Expenses (from budget tables if populated)
      // Defaults to 0 if tables are empty or inaccessible
      try {
        // Attempt from budget_items first
        const { data: bi, error: biErr } = await supabase
          .from('budget_items')
          .select('*')
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
        }
      } catch (e) {
        console.warn('Budget fetch failed:', e)
      }

      // Net Worth (sum of accounts.starting_balance as a baseline)
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('starting_balance')
        if (error) throw error
        const rows = (data || []) as AccountLite[]
        const sum = rows.reduce((s, r) => s + Number(r.starting_balance ?? 0), 0)
        setNetWorth(sum)
      } catch (e) {
        console.warn('Net worth fetch failed:', e)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <div className="flex w-full items-center gap-4 md:gap-2 lg:gap-4">
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
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <div className="flex w-full items-center gap-4 md:gap-2 lg:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Activity className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <div className="pl-8 text-sm font-medium">FinMate Dashboard</div>
            </div>
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
              <p className="text-xs text-muted-foreground">Income − Expenses − Budget</p>
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
          <Card className="xl:col-span-2" x-chunk="dashboard-01-chunk-4">
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Recent Expenses</CardTitle>
                <CardDescription>
                  Your latest expense transactions from the FinMate bot.
                </CardDescription>
              </div>
              <Button asChild size="sm" className="ml-auto gap-1">
                <a href="#">
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm" x-chunk="dashboard-02-chunk-1">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                      You have no expenses
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You can start tracking as soon as you send your first message to the bot.
                    </p>
                    <Button className="mt-4">Learn More</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {expense.category}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {expense.merchant || 'Unknown merchant'}
                        </p>
                      </div>
                      <div className="ml-auto font-medium">
                        ${parseFloat(expense.amount.toString()).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
                  <p className="text-sm font-medium leading-none mb-1">
                    Server Status
                  </p>
                  <p className="text-sm text-muted-foreground">
                    finmate-bot.onrender.com
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium leading-none mb-1">
                    Database
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connected • Supabase
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium leading-none mb-1">
                    Last Sync
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Just now
                  </p>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    📱 Send messages to your Telegram bot for real-time expense tracking
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
