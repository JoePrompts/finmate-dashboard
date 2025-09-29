'use client'

import { useEffect, useMemo, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { useTheme } from "@/app/providers"
import { Monitor, Moon, RefreshCw, Settings, Sun, ShoppingCart, Utensils, Car, Plane, Home, PlugZap, Film, Dumbbell, Landmark, Tag } from "lucide-react"

type BudgetDisplay = { id: string | number; name: string; amount: number; progressPct: number; paid: number; due?: string | null }

function getCategoryIcon(category: string) {
  const cat = (category || '').toLowerCase()
  if (cat.includes('grocery') || cat.includes('supermarket')) return ShoppingCart
  if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('coffee')) return Utensils
  if (cat.includes('transport') || cat.includes('uber') || cat.includes('taxi') || cat.includes('car')) return Car
  if (cat.includes('travel') || cat.includes('flight') || cat.includes('air')) return Plane
  if (cat.includes('rent') || cat.includes('mortgage') || cat.includes('home') || cat.includes('housing')) return Home
  if (cat.includes('utility') || cat.includes('electric') || cat.includes('power') || cat.includes('internet')) return PlugZap
  if (cat.includes('entertain') || cat.includes('movie') || cat.includes('cinema') || cat.includes('tv') || cat.includes('game')) return Film
  if (cat.includes('fitness') || cat.includes('gym')) return Dumbbell
  if (cat.includes('salary') || cat.includes('payroll') || cat.includes('income')) return Landmark
  if (cat.includes('shopping') || cat.includes('retail')) return ShoppingCart
  return Tag
}

export default function BudgetPage() {
  const { setTheme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetDisplay[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [itemsByCategory, setItemsByCategory] = useState<Map<string, BudgetDisplay[]>>(new Map())
  const [itemIdToCat, setItemIdToCat] = useState<Map<string, string>>(new Map())
  const [itemIdToName, setItemIdToName] = useState<Map<string, string>>(new Map())
  const [txByItemId, setTxByItemId] = useState<Map<string, TxRow[]>>(new Map())
  type TxRow = {
    id: string
    merchant: string | null
    amount: number | string | null
    currency: string | null
    date: string | null
    created_at: string
    payment_method?: string | null
    account?: string | null
    category?: string | null
    entry_type?: string | null
    description?: string | null
  }
  const [txRows, setTxRows] = useState<TxRow[]>([])

  // Load auth session
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null)
      setAuthReady(true)
    }).catch(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    async function fetchBudget() {
      setErrorMsg(null)
      if (!SUPABASE_CONFIGURED) {
        setLoading(false)
        setErrorMsg('Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to fetch data.')
        return
      }
      if (!authReady || !userId) return
      setLoading(true)
      try {
        type BudgetRecord = Record<string, unknown>
        const { data: uDataB, error: uErrB } = await supabase.auth.getUser()
        if (uErrB || !uDataB?.user) throw new Error('Not authenticated')
        const userIdB = uDataB.user.id

        // Fetch budget items for this user
        const { data: bi, error: biErr } = await supabase
          .from('budget_items')
          .select('*')
          .eq('user_id', userIdB)
          .limit(1000)
        if (!biErr && bi && bi.length > 0) {
          const numericKeys = ['planned_amount', 'amount', 'expected_amount'] as const
          const first = bi[0] as BudgetRecord
          const amountKeyPrimary = numericKeys.find(k => {
            const v = first[k as string]
            return typeof v === 'number' || typeof v === 'string'
          }) as (typeof numericKeys)[number] | undefined

          // Build display list aggregated by category
          const catKeys = ['category','group','type','label'] as const
          const nameKeys = ['name','title','label'] as const
          const dueKeys = ['due_date','due','deadline','dueDate','due_at'] as const
          const idToCat = new Map<string, string>()
          const plannedByCat = new Map<string, number>()
          const dueByCat = new Map<string, string>()
          type ItemBasic = { id: string, cat: string, name: string, planned: number, due?: string | null }
          const itemBasics: ItemBasic[] = []
          ;(bi as BudgetRecord[]).forEach((r) => {
            const amountKey = amountKeyPrimary || (['planned_amount','amount','expected_amount'].find(k => typeof r[k as string] === 'number' || typeof r[k as string] === 'string'))
            const rawAmount = amountKey ? r[amountKey as string] : 0
            const amount = typeof rawAmount === 'number' ? rawAmount : typeof rawAmount === 'string' ? parseFloat(rawAmount) : 0
            const rawId = r['id'] as unknown
            const idStr = rawId == null ? null : String(rawId)
            const catKey = catKeys.find(k => typeof r[k as string] === 'string') as (typeof catKeys)[number] | undefined
            const rawCat = catKey ? (r[catKey as string] as string) : ''
            const cat = (rawCat || 'Uncategorized').toString()
            if (idStr) idToCat.set(idStr, cat)
            plannedByCat.set(cat, (plannedByCat.get(cat) || 0) + (Number.isFinite(amount) ? Number(amount) : 0))
            // collect item names per category
            const nameKey = nameKeys.find(k => typeof r[k as string] === 'string') as (typeof nameKeys)[number] | undefined
            const name = nameKey ? String(r[nameKey as string]) : undefined
            // name collected in itemBasics below
            const dueKey = dueKeys.find(k => typeof r[k as string] === 'string') as (typeof dueKeys)[number] | undefined
            const due = dueKey ? (r[dueKey as string] as string) : null
            if (due) {
              const prev = dueByCat.get(cat)
              if (!prev || (Date.parse(due) || Infinity) < (Date.parse(prev) || Infinity)) {
                dueByCat.set(cat, due)
              }
            }
            if (idStr) {
              itemBasics.push({ id: idStr, cat, name: name || 'Item', planned: Number.isFinite(amount) ? Number(amount) : 0, due })
            }
          })

          // Payments within current month
          try {
            const { data: pays, error: payErr } = await supabase
              .from('budget_payments')
              .select('budget_item_id, amount, date, user_id')
              .eq('user_id', userIdB)
              .limit(2000)
            if (payErr) throw payErr

            const start = new Date()
            start.setUTCDate(1)
            start.setUTCHours(0, 0, 0, 0)
            const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999))

            const sumByItem = new Map<string, number>()
            for (const row of (pays || []) as BudgetRecord[]) {
              const recDate = row['date']
              if (typeof recDate === 'string') {
                const ts = Date.parse(recDate)
                if (!Number.isFinite(ts) || ts < start.getTime() || ts > end.getTime()) continue
              }
              const v = row['budget_item_id'] as unknown
              const itemRef = v == null ? null : String(v)
              if (!itemRef) continue
              const val = row['amount']
              const paid = typeof val === 'number' ? val : (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) ? Number(val) : 0
              sumByItem.set(itemRef, (sumByItem.get(itemRef) || 0) + (Number.isFinite(paid) ? paid : 0))
            }

            const paidByCat = new Map<string, number>()
            for (const [itemId, cat] of idToCat.entries()) {
              const paid = sumByItem.get(itemId) || 0
              if (!paid) continue
              paidByCat.set(cat, (paidByCat.get(cat) || 0) + paid)
            }

            const withProgress: BudgetDisplay[] = Array.from(plannedByCat.entries()).map(([cat, amt]) => {
              const paid = paidByCat.get(cat) || 0
              const progressPct = amt > 0 ? (paid / amt) * 100 : 0
              const due = dueByCat.get(cat) ?? null
              return { id: cat, name: cat, amount: amt, progressPct, paid, due }
            })
            withProgress.sort((a, b) => {
              const p = (b.progressPct || 0) - (a.progressPct || 0)
              if (p !== 0) return p
              return (b.amount || 0) - (a.amount || 0)
            })
            setBudgetItems(withProgress)
            // build per-item breakdown by category
            const itemsMap = new Map<string, BudgetDisplay[]>()
            for (const ib of itemBasics) {
              const paid = sumByItem.get(ib.id) || 0
              const progressPct = ib.planned > 0 ? (paid / ib.planned) * 100 : 0
              const key = ib.cat.toLowerCase()
              if (!itemsMap.has(key)) itemsMap.set(key, [])
              itemsMap.get(key)!.push({ id: ib.id, name: ib.name, amount: ib.planned, paid, progressPct, due: ib.due || null })
            }
            for (const [k, arr] of itemsMap.entries()) {
              arr.sort((a, b) => (b.amount || 0) - (a.amount || 0))
              itemsMap.set(k, arr)
            }
            setItemsByCategory(itemsMap)
            // expose id->cat and id->name maps
            const mapCat = new Map<string, string>()
            const mapName = new Map<string, string>()
            for (const ib of itemBasics) {
              mapCat.set(ib.id, ib.cat.toLowerCase())
              mapName.set(ib.id, ib.name)
            }
            setItemIdToCat(mapCat)
            setItemIdToName(mapName)
          } catch (e) {
            const cats: BudgetDisplay[] = Array.from(plannedByCat.entries()).map(([cat, amt]) => ({ id: cat, name: cat, amount: amt, progressPct: 0, paid: 0, due: dueByCat.get(cat) ?? null }))
            cats.sort((a, b) => (b.amount || 0) - (a.amount || 0))
            setBudgetItems(cats)
            // items breakdown with paid=0
            const itemsMap = new Map<string, BudgetDisplay[]>()
            for (const ib of itemBasics) {
              const key = ib.cat.toLowerCase()
              if (!itemsMap.has(key)) itemsMap.set(key, [])
              itemsMap.get(key)!.push({ id: ib.id, name: ib.name, amount: ib.planned, paid: 0, progressPct: 0, due: ib.due || null })
            }
            for (const [k, arr] of itemsMap.entries()) {
              arr.sort((a, b) => (b.amount || 0) - (a.amount || 0))
              itemsMap.set(k, arr)
            }
            setItemsByCategory(itemsMap)
            const mapCat = new Map<string, string>()
            const mapName = new Map<string, string>()
            for (const ib of itemBasics) {
              mapCat.set(ib.id, ib.cat.toLowerCase())
              mapName.set(ib.id, ib.name)
            }
            setItemIdToCat(mapCat)
            setItemIdToName(mapName)
          }
        } else {
          // If no budget_items, leave empty
          setBudgetItems([])
          setItemsByCategory(new Map())
          setItemIdToCat(new Map())
          setItemIdToName(new Map())
        }
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : 'Failed to fetch budget')
      } finally {
        setLoading(false)
      }
    }
    fetchBudget()
  }, [authReady, userId])

  // Link budget_payments to transactions and group by budget item
  useEffect(() => {
    async function linkPaymentsToTx() {
      if (!SUPABASE_CONFIGURED) return
      if (!authReady || !userId) return
      if (itemIdToCat.size === 0) return
      try {
        const start = new Date()
        start.setUTCDate(1)
        start.setUTCHours(0, 0, 0, 0)
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999))
        const { data: pays, error: payErr } = await supabase
          .from('budget_payments')
          .select('*')
          .eq('user_id', userId)
          .gte('date', start.toISOString())
          .lte('date', end.toISOString())
          .limit(5000)
        if (payErr) throw payErr

        const txIdKeys = ['transaction_id','tx_id','expense_id','transaction','transaction_ref','transactionId','expenseId']
        const ids: string[] = []
        const rows: { p: Record<string, unknown>, txId: string }[] = []
        for (const p of (pays || []) as Record<string, unknown>[]) {
          let txId: string | null = null
          for (const k of txIdKeys) {
            const v = p[k]
            if (typeof v === 'string' && v.trim()) { txId = v; break }
            if (typeof v === 'number' && Number.isFinite(v)) { txId = String(v); break }
          }
          if (txId) { ids.push(txId); rows.push({ p, txId }) }
        }
        if (ids.length === 0) { setTxByItemId(new Map()); return }

        const { data: txs, error: txErr } = await supabase
          .from('transactions')
          .select('id, merchant, amount, currency, date, created_at, payment_method, account, category, entry_type, description')
          .in('id', Array.from(new Set(ids)))
        if (txErr) throw txErr
        const byId = new Map<string, TxRow>()
        for (const r of (txs || []) as TxRow[]) byId.set(r.id, r)

        const itemMap = new Map<string, TxRow[]>()
        for (const { p, txId } of rows) {
          const tx = byId.get(txId)
          if (!tx) continue
          const bi = p['budget_item_id'] as unknown
          const itemId = bi == null ? null : String(bi)
          if (!itemId) continue
          if (!itemMap.has(itemId)) itemMap.set(itemId, [])
          itemMap.get(itemId)!.push(tx)
        }
        setTxByItemId(itemMap)
      } catch {
        setTxByItemId(new Map())
      }
    }
    linkPaymentsToTx()
  }, [authReady, userId, itemIdToCat])

  // Fetch current month transactions for this user once
  useEffect(() => {
    async function fetchTx() {
      if (!SUPABASE_CONFIGURED) return
      if (!authReady || !userId) return
      try {
        const start = new Date()
        start.setUTCDate(1)
        start.setUTCHours(0, 0, 0, 0)
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999))
        const { data, error } = await supabase
          .from('transactions')
          .select('id, merchant, amount, currency, date, created_at, payment_method, account, category, entry_type, description')
          .eq('user_id', userId)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
        if (error) throw error
        setTxRows((data || []) as TxRow[])
      } catch {
        setTxRows([])
      }
    }
    fetchTx()
  }, [authReady, userId])

  const txByCategory = useMemo(() => {
    const map = new Map<string, TxRow[]>()
    const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
    for (const r of txRows) {
      const tcat = norm(r.category)
      if (!tcat) continue
      if (!map.has(tcat)) map.set(tcat, [])
      map.get(tcat)!.push(r)
    }
    return map
  }, [txRows])

  function getTxForCategory(category: string): TxRow[] {
    const key = String(category || '').trim().toLowerCase()
    if (!key) return []
    const direct = txByCategory.get(key) || []
    if (direct.length) return direct
    // fallback fuzzy: include those containing the key
    const out: TxRow[] = []
    for (const [k, list] of txByCategory.entries()) {
      if (k.includes(key) || key.includes(k)) out.push(...list)
    }
    return out
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b sticky top-0 z-50 bg-background supports-[backdrop-filter]:bg-background/80 backdrop-blur px-4 md:px-6">
        <div className="flex w-full items-center gap-4 md:gap-2 lg:gap-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
            <div className="pl-0 text-sm font-medium">Budget</div>
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
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Monthly Budget</CardTitle>
            <CardDescription>Plan and track this month&apos;s budget.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid gap-6">
                {budgetItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No budget items found.</div>
                ) : (
                  budgetItems.map((bi) => {
                    const pct = Math.max(0, bi.progressPct || 0)
                    const barValue = Math.min(100, pct)
                    const over = pct >= 100
                    const indicatorClass = over ? 'bg-red-500' : undefined
                    const dueLabel = bi.due ? (() => { const d = new Date(bi.due as string); return isNaN(d.getTime()) ? bi.due : d.toLocaleDateString() })() : null
                    const Icon = getCategoryIcon(String(bi.name || ''))
                    const catName = String(bi.name || '')
                    const catKeyLower = catName.toLowerCase()
                    const itemBreakdown = itemsByCategory.get(catKeyLower) || itemsByCategory.get(catName) || []
                    const txsByItemForCat = (itemsByCategory.get(catKeyLower) || []).map((it) => ({ item: it, txs: txByItemId.get(String(it.id)) || [] }))
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
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="View details" className="ml-1">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8"/><circle cx="12" cy="12" r="3"/></svg>
                              </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[380px] max-w-[380px] sm:w-[640px] sm:max-w-[640px] overflow-y-auto">
                              <SheetHeader>
                                <SheetTitle>{catName}</SheetTitle>
                                <SheetDescription>Budget items and transactions for this category.</SheetDescription>
                              </SheetHeader>
                              <div className="mt-4 grid gap-4 text-sm pr-1 pb-6">
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground">Budget Breakdown</div>
                            {itemBreakdown.length ? (
                              <div className="grid gap-4">
                                {itemBreakdown.map((it) => {
                                  const pcti = Math.max(0, it.progressPct || 0)
                                  const barValI = Math.min(100, pcti)
                                  const overI = pcti >= 100
                                  const indicatorClassI = overI ? 'bg-red-500' : undefined
                                  const dueItem = it.due ? (() => { const d = new Date(it.due as string); return isNaN(d.getTime()) ? it.due : d.toLocaleDateString() })() : null
                                  return (
                                    <div key={it.id} className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-medium leading-none truncate">{it.name}</div>
                                        <div className="ml-auto text-sm font-medium">${it.amount.toLocaleString()}</div>
                                      </div>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-2 cursor-default">
                                            <Progress value={barValI} className="h-2 flex-1" indicatorClassName={indicatorClassI} />
                                            <div className="w-12 text-right text-xs font-medium text-foreground">{Math.round(pcti)}%</div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="center" className="text-xs">
                                          <div>Paid: ${ (it.paid ?? 0).toLocaleString() } of ${ it.amount.toLocaleString() }</div>
                                        </TooltipContent>
                                      </Tooltip>
                                      {dueItem && (
                                        <div className="text-xs text-muted-foreground">Due: {dueItem}</div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="text-muted-foreground">No budget items found for this category.</div>
                            )}
                          </div>

                                <div className="border-t pt-3">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">Transactions linked to budget payments</div>
                                  {txsByItemForCat.every(({txs}) => txs.length === 0) ? (
                                    <div className="text-muted-foreground">No linked transactions for this category.</div>
                                  ) : (
                                    <div className="space-y-4">
                                      {txsByItemForCat.map(({ item, txs }) => (
                                        <div key={item.id} className="space-y-2">
                                          <div className="text-sm font-medium">{item.name}</div>
                                          {txs.length === 0 ? (
                                            <div className="text-xs text-muted-foreground">No transactions linked.</div>
                                          ) : (
                                            <div className="space-y-3">
                                              {txs.map((r) => {
                                        const amountNum = Number(r.amount ?? 0) || 0
                                        const type = String(r.entry_type || '').toLowerCase()
                                        const sign = type === 'income' ? 1 : type === 'expense' ? -1 : amountNum >= 0 ? 1 : -1
                                        const abs = Math.abs(amountNum)
                                        const symbol = (r.currency || 'USD').toUpperCase() === 'USD' ? '$' : ''
                                        const isExpense = sign < 0
                                        const when = r.date || r.created_at
                                        const dateLabel = when ? new Date(when).toLocaleString() : '—'
                                        return (
                                          <div key={r.id} className="flex items-center">
                                            <div className="min-w-0">
                                              <div className="font-medium truncate max-w-[260px]">{r.merchant || '—'}</div>
                                              <div className="text-xs text-muted-foreground">{dateLabel}</div>
                                            </div>
                                            <div className={cn("ml-auto tabular-nums text-sm", !isExpense && "text-emerald-600")} style={isExpense ? { color: 'rgb(248 113 113 / var(--tw-text-opacity, 1))' } : {}}>
                                              {isExpense ? '-' : '+'}{symbol}{abs.toLocaleString()} {((r.currency || 'USD').toUpperCase() !== 'USD') ? (r.currency || '').toString().toUpperCase() : ''}
                                            </div>
                                          </div>
                                        )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
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
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
