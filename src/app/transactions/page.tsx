'use client'

import { useEffect, useMemo, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Monitor, Moon, RefreshCw, Settings, Sun, Eye } from "lucide-react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { supabase, SUPABASE_CONFIGURED, type Expense } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useTheme } from "@/app/providers"
import { Badge } from "@/components/ui/badge"
import type { DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export default function TransactionsPage() {
  const { setTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  type ExpenseRow = Expense & {
    entry_type?: string | null
    account?: string | null
    edited?: boolean | null
    edited_at?: string | null
    updated_at?: string | null
    edit_history?: unknown
  }
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [dateOpen, setDateOpen] = useState(false)

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
      const d = when ? new Date(when) : null
      const ts = d ? d.getTime() : 0
      // Start-of-day timestamp (local) for grouping by transaction date
      const dayTs = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : 0
      // Creation timestamp for tie-breaking when multiple on same day
      const createdTs = r.created_at ? Date.parse(r.created_at) : ts
      return {
        id: r.id,
        merchant: r.merchant || '—',
        amount: signed,
        currency: (r.currency || 'USD').toUpperCase(),
        date: when,
        ts,
        dayTs,
        createdTs,
        account: r.payment_method || r.account || '—',
        isCredit,
        category: r.category || '—',
        type: type ? (type[0].toUpperCase() + type.slice(1)) : (signed >= 0 ? 'Income' : 'Expense'),
        description: r.description || '',
      }
    })
    items.sort((a, b) => {
      if ((b.dayTs || 0) !== (a.dayTs || 0)) return (b.dayTs || 0) - (a.dayTs || 0)
      return (b.createdTs || 0) - (a.createdTs || 0)
    })
    return items
  }, [rows, creditNames])

  // Unique account options derived from data
  const accountOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of data) {
      const acc = (r.account || '').trim()
      if (acc) set.add(acc)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  // Apply filters
  const filtered = useMemo(() => {
    const fromStart = dateFrom ? (() => { const [y,m,d] = dateFrom.split('-').map(Number); return new Date(y, (m||1)-1, d||1).getTime() })() : null
    const toEnd = dateTo ? (() => { const [y,m,d] = dateTo.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 23,59,59,999).getTime() })() : null
    return data.filter((r) => {
      if (accountFilter && (r.account || '').trim() !== accountFilter) return false
      if (fromStart !== null && (r.ts || 0) < fromStart) return false
      if (toEnd !== null && (r.ts || 0) > toEnd) return false
      return true
    })
  }, [data, accountFilter, dateFrom, dateTo])

  // Pagination state (10 per page)
  const perPage = 10
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const start = (page - 1) * perPage
  const end = start + perPage
  const pageRows = filtered.slice(start, end)

  // Map of raw DB rows by id for full-field rendering in the Sheet
  const rowById = useMemo(() => {
    const m = new Map<string, ExpenseRow>()
    for (const r of rows) m.set(r.id, r)
    return m
  }, [rows])

  // Keep page within bounds when data changes
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [accountFilter, dateFrom, dateTo])

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
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b sticky top-0 z-50 bg-background supports-[backdrop-filter]:bg-background/80 backdrop-blur px-4 md:px-6">
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
          {/* Filters */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium">Filters</div>
            <div className="flex items-center gap-2 flex-wrap">
              {accountFilter ? (
                <Badge variant="secondary" className="max-w-[240px] truncate" title={accountFilter}>
                  Account: {accountFilter}
                </Badge>
              ) : null}
              {(dateFrom || dateTo) ? (
                <Badge variant="secondary" className="max-w-[260px] truncate" title={`${dateFrom ?? '…'} → ${dateTo ?? '…'}`}>
                  Date: {dateFrom ?? '…'} → {dateTo ?? '…'}
                </Badge>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {accountFilter ? 'Account: ' + accountFilter : 'Filter by account'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setAccountFilter(null)}>All accounts</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {accountOptions.length === 0 ? (
                    <DropdownMenuItem disabled>No accounts</DropdownMenuItem>
                  ) : (
                    accountOptions.map((name) => (
                      <DropdownMenuItem key={name} onClick={() => setAccountFilter(name)}>
                        {name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Date range popover with single-month calendar */}
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {dateFrom || dateTo ? (
                      `Date: ${dateFrom ?? '…'} → ${dateTo ?? '…'}`
                    ) : (
                      'Filter by date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-3">
                  <div className="space-y-2">
                    <Calendar
                      mode="range"
                      numberOfMonths={1}
                      selected={range}
                      onSelect={(v) => {
                        setRange(v)
                        const from = v?.from ?? undefined
                        const to = v?.to ?? undefined
                        const fmt = (d?: Date) => {
                          if (!d) return null
                          const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0')
                          return `${y}-${m}-${dd}`
                        }
                        setDateFrom(fmt(from))
                        setDateTo(fmt(to))
                      }}
                      initialFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      {(dateFrom || dateTo) && (
                        <Button variant="outline" size="sm" onClick={() => { setRange(undefined); setDateFrom(null); setDateTo(null) }}>
                          Clear
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setDateOpen(false)}>Done</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
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
                  <TableHead className="w-[56px] text-right">
                    <span className="sr-only">View</span>
                  </TableHead>
                
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const raw = rowById.get(r.id)
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
                      <TableCell className="text-right">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="right" className="w-[380px] max-w-[380px] sm:w-[640px] sm:max-w-[640px] overflow-y-auto">
                            <SheetHeader>
                              <SheetTitle>Transaction Details</SheetTitle>
                              <SheetDescription>{r.merchant}</SheetDescription>
                            </SheetHeader>
                            <div className="mt-4 grid gap-3 text-sm pr-1 pb-6">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Amount</span>
                              <span className={cn("font-medium tabular-nums", (r.type.toLowerCase()==='income'||r.amount>=0) && "text-emerald-600")} style={(r.type.toLowerCase()==='expense'||r.amount<0) ? { color: 'rgb(248 113 113 / var(--tw-text-opacity, 1))' } : {}}>
                                {(r.amount>=0?'+':'-')}{r.currency === 'USD' ? '$' : ''}{Math.abs(r.amount).toLocaleString()} {r.currency !== 'USD' ? r.currency : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Date</span>
                              <span>{r.date ? new Date(r.date).toLocaleString() : '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Account</span>
                              <span className="truncate max-w-[260px] text-right">{r.account}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Credit</span>
                              <span>{r.isCredit ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Category</span>
                              <span className="truncate max-w-[260px] text-right">{r.category}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Type</span>
                              <span>{r.type}</span>
                            </div>
                            {r.description && (
                              <div>
                                <div className="text-muted-foreground mb-1">Description</div>
                                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {r.description}
                                </div>
                              </div>
                            )}
                            {/* Database fields */}
                            <div className="mt-4 border-t pt-3">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Database Fields</div>
                              <div className="grid gap-2 text-sm">
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-xs">{raw?.id || '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Amount</span><span>{raw?.amount ?? '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Currency</span><span>{raw?.currency || '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Merchant</span><span className="truncate max-w-[260px] text-right">{raw?.merchant || '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Category</span><span className="truncate max-w-[260px] text-right">{raw?.category || '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Payment Method</span><span className="truncate max-w-[260px] text-right">{raw?.payment_method || '—'}</span></div>
                                {typeof raw?.account !== 'undefined' && (
                                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Account</span><span className="truncate max-w-[260px] text-right">{raw?.account || '—'}</span></div>
                                )}
                                {typeof raw?.entry_type !== 'undefined' && (
                                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Entry Type</span><span>{raw?.entry_type || '—'}</span></div>
                                )}
                                {typeof raw?.description !== 'undefined' && (
                                  <div>
                                    <div className="text-muted-foreground mb-1">Description</div>
                                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                      {raw?.description || '—'}
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Date</span><span>{raw?.date ? new Date(raw.date).toLocaleString() : '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Created At</span><span>{raw?.created_at ? new Date(raw.created_at).toLocaleString() : '—'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs truncate max-w-[260px] text-right">{raw?.user_id || '—'}</span></div>
                                {typeof raw?.edited !== 'undefined' && (
                                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Edited</span><span>{String(raw?.edited)}</span></div>
                                )}
                                {typeof raw?.edited_at !== 'undefined' && (
                                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Edited At</span><span>{raw?.edited_at ? new Date(raw.edited_at).toLocaleString() : '—'}</span></div>
                                )}
                                {typeof raw?.updated_at !== 'undefined' && (
                                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Updated At</span><span>{raw?.updated_at ? new Date(raw.updated_at).toLocaleString() : '—'}</span></div>
                                )}
                                {/* Render any other unknown fields for completeness */}
                                {(() => {
                                  const known = new Set([
                                    'id','amount','currency','merchant','category','payment_method','account','entry_type','description','date','created_at','user_id','edited','edited_at','updated_at','edit_history'
                                  ])
                                  const rawRecord: Record<string, unknown> = (raw ?? {}) as unknown as Record<string, unknown>
                                  const entries = Object.entries(rawRecord).filter(([k]) => !known.has(k))
                                  if (!entries.length) return null
                                  return entries.map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between">
                                      <span className="text-muted-foreground">{k}</span>
                                      <span className="truncate max-w-[260px] text-right">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</span>
                                    </div>
                                  ))
                                })()}
                                {/* Edit history (if available) */}
                                {(() => {
                                  const eh = raw?.edit_history
                                  if (typeof eh === 'undefined') return null
                                  return (
                                    <div className="mt-2">
                                      <div className="text-muted-foreground mb-1">Edit History</div>
                                      {typeof eh === 'string' ? (
                                        <pre className="max-h-[50vh] overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">{eh}</pre>
                                      ) : (
                                        <pre className="max-h-[50vh] overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(eh, null, 2)}</pre>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                              {/* Raw JSON for full visibility */}
                              <div className="mt-3">
                                <div className="text-muted-foreground mb-1">Raw Record</div>
                                <pre className="max-h-[50vh] overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(raw, null, 2)}</pre>
                              </div>
                            </div>
                          </div>
                          </SheetContent>
                        </Sheet>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableCaption>
                {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
                {accountFilter ? ` • Account: ${accountFilter}` : ''}
              </TableCaption>
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
