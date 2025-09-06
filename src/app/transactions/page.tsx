'use client'

import { useEffect, useMemo, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Monitor, Moon, RefreshCw, Settings, Sun } from "lucide-react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { supabase, SUPABASE_CONFIGURED, type Expense } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useTheme } from "@/app/providers"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

export default function TransactionsPage() {
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  type ExpenseRow = Expense & { entry_type?: string | null; account?: string | null }
  const [rows, setRows] = useState<ExpenseRow[]>([])

  // Credit card names set from accounts
  const [creditNames, setCreditNames] = useState<Set<string>>(new Set())

  // Theme logic is managed by ThemeProvider (see src/app/providers.tsx)

  useEffect(() => {
    async function fetchAll() {
      if (!SUPABASE_CONFIGURED) {
        setErrorMsg('Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to fetch data.')
        setLoading(false)
        return
      }
      try {
        // Transactions
        const { data: tx, error: txErr } = await supabase
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: false })
        if (txErr) throw txErr
        setRows((tx || []) as ExpenseRow[])

        // Accounts for credit detection
        try {
          const { data: accts, error: aerr } = await supabase.from('accounts').select('*')
          if (!aerr && accts) {
            type AccountLite = { name?: string | null; type?: string | null; account_type?: string | null; is_credit_card?: boolean | null }
            const set = new Set<string>()
            for (const r of accts as AccountLite[]) {
              const name = String(r.name ?? '').toLowerCase()
              const t = String(r.type ?? r.account_type ?? '').toLowerCase()
              const byFlag = r.is_credit_card === true
              const byType = t.includes('credit') || t.includes('card')
              const byName = name.includes('card')
              if (byFlag || byType || byName) {
                if (name) set.add(name)
              }
            }
            setCreditNames(set)
          }
        } catch {
          // Ignore credit detection failure
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch transactions')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const data = useMemo(() => {
    const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
    const items = rows.map((r) => {
      const amount = Number(r.amount)
      const type = String(r.entry_type || '').toLowerCase()
      // Sign based on entry_type if present
      const sign = type === 'income' ? 1 : type === 'expense' ? -1 : amount >= 0 ? 1 : -1
      const abs = Math.abs(amount)
      const signed = sign * abs
      const pmRaw = r.payment_method || r.account || ''
      const pm = norm(pmRaw)
      let isCredit = false
      if (pm) {
        for (const name of creditNames) {
          if (pm.includes(name) || name.includes(pm)) { isCredit = true; break }
        }
      }
      const when = r.date || r.created_at
      const ts = when ? Date.parse(when) : 0
      return {
        id: r.id,
        merchant: r.merchant || '—',
        amount: signed,
        currency: (r.currency || 'USD').toUpperCase(),
        date: when,
        ts,
        account: r.payment_method || r.account || '—',
        isCredit,
        category: r.category || '—',
        type: type ? (type[0].toUpperCase() + type.slice(1)) : (signed >= 0 ? 'Income' : 'Expense'),
        description: r.description || '',
      }
    })
    items.sort((a, b) => (b.ts || 0) - (a.ts || 0))
    return items
  }, [rows, creditNames])

  // Pagination state (10 per page)
  const perPage = 10
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(data.length / perPage))
  const start = (page - 1) * perPage
  const end = start + perPage
  const pageRows = data.slice(start, end)

  // Keep page within bounds when data changes
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  function buildPages(current: number, total: number): (number | "dots")[] {
    const pages: (number | "dots")[] = []
    const add = (n: number | "dots") => pages.push(n)
    const window = 1
    const left = Math.max(2, current - window)
    const right = Math.min(total - 1, current + window)
    add(1)
    if (left > 2) add("dots")
    for (let i = left; i <= right; i++) add(i)
    if (right < total - 1) add("dots")
    if (total > 1) add(total)
    return pages
  }

  function UsdToCop({ amount }: { amount: number }) {
    const [open, setOpen] = useState(false)
    const { data: rate, isLoading, isError, error, refetch } = useQuery({
      queryKey: ["fx", "USD", "COP"],
      queryFn: async () => {
        const res = await fetch('https://open.er-api.com/v6/latest/USD')
        if (!res.ok) throw new Error(`FX HTTP ${res.status}`)
        const json = await res.json()
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
          <span className="ml-1 underline decoration-dotted underline-offset-2 cursor-default">USD</span>
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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-background px-4 md:px-6 sticky top-0">
        <div className="flex w-full items-center gap-4 md:gap-2 lg:gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
            <div className="pl-0 text-sm font-medium">Transactions</div>
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
            <AlertTitle>Unable to fetch transactions</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
          <div className="rounded-md border overflow-hidden">
            <Table className="table-fixed">
              <TableHeader className="bg-muted [&_th]:text-foreground">
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right w-[160px]">Amount</TableHead>
                  <TableHead className="w-[150px]">Date</TableHead>
                  <TableHead className="w-[200px]">Account</TableHead>
                  <TableHead className="w-[90px]">Credit</TableHead>
                  <TableHead className="w-[150px]">Category</TableHead>
                  <TableHead className="w-[110px]">Type</TableHead>
                
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const d = r.date ? new Date(r.date) : null
                  const dateLabel = d ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
                  const isIncome = r.type.toLowerCase() === 'income' || r.amount >= 0
                  const isExpense = r.type.toLowerCase() === 'expense' || r.amount < 0
                  const abs = Math.abs(r.amount)
                  const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: '$', CAD: '$' }
                  const symbol = currencySymbols[r.currency] || '$'
                  return (
                    <TableRow key={r.id} className="[&>td]:py-3">
                      <TableCell className="whitespace-nowrap">{r.merchant}</TableCell>
                      <TableCell
                        className={cn("text-right font-medium tabular-nums", isIncome && "text-emerald-600")}
                        style={ isExpense ? { color: 'rgb(248 113 113 / var(--tw-text-opacity, 1))' } : {} }
                      >
                        {isIncome ? '+' : isExpense ? '-' : ''}{symbol}{abs.toLocaleString()}
                        {r.currency === 'USD' ? (
                          <UsdToCop amount={abs} />
                        ) : r.currency === 'COP' ? (
                          <span className="ml-1">COP</span>
                        ) : (
                          <span className="ml-1">{r.currency}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dateLabel}</TableCell>
                      <TableCell className="whitespace-nowrap truncate max-w-[200px]">{r.account}</TableCell>
                      <TableCell>{r.isCredit ? 'Yes' : 'No'}</TableCell>
                      <TableCell className="whitespace-nowrap truncate max-w-[150px]">{r.category}</TableCell>
                      <TableCell>{r.type}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableCaption>{data.length} transaction{data.length === 1 ? '' : 's'}</TableCaption>
            </Table>
          </div>

          {/* Pagination controls */}
          <Pagination className="mt-4">
            <PaginationContent className="w-full items-center justify-center">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }}
                />
              </PaginationItem>
              {buildPages(page, pageCount).map((p, idx) => (
                <PaginationItem key={idx}>
                  {p === "dots" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      onClick={(e) => { e.preventDefault(); setPage(p as number) }}
                    >
                      {p}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(pageCount, p + 1)) }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          </>
        )}
      </main>
    </>
  )
}
