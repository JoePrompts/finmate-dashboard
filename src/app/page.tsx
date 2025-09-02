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
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  RefreshCw, 
  Activity, 
  AlertCircle, 
  Settings, 
  Moon, 
  Sun, 
  Monitor,
  ArrowUpRight
} from "lucide-react"

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [stats, setStats] = useState({
    total: 0,
    count: 0,
    topCategory: 'N/A'
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
        
        // Calculate stats
        if (data && data.length > 0) {
          const total = data.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
          const categories: Record<string, number> = {}
          
          data.forEach(exp => {
            categories[exp.category] = (categories[exp.category] || 0) + parseFloat(exp.amount.toString())
          })
          
          const topCategory = Object.entries(categories)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'

          setStats({
            total,
            count: data.length,
            topCategory
          })
        }
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
              <CardTitle className="text-sm font-medium">
                Total Expenses
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                All time spending
              </p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Transactions
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.count}</div>
              <p className="text-xs text-muted-foreground">
                Total expenses tracked
              </p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Category</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.topCategory}</div>
              <p className="text-xs text-muted-foreground">
                Highest spending category
              </p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Online</div>
              <p className="text-xs text-muted-foreground">
                FinMate bot is active
              </p>
            </CardContent>
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
