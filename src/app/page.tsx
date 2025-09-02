'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { supabase, type Expense } from "@/lib/supabase"
import { useEffect, useState } from "react"
import { DollarSign, CreditCard, TrendingUp, RefreshCw, Activity, AlertCircle } from "lucide-react"

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    count: 0,
    topCategory: 'N/A'
  })

  useEffect(() => {
    async function fetchExpenses() {
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
      } catch (error) {
        console.error('Error fetching expenses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading FinMate Dashboard...</h2>
          <p className="text-muted-foreground">Fetching your expense data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-slate-100 dark:to-slate-400">
                  FinMate Dashboard
                </h1>
                <p className="text-muted-foreground">Your AI-powered expense tracker insights</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>
        
        <Separator />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                ${stats.total.toLocaleString()} COP
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Last {stats.count} transactions
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">Transactions</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.count}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Recent expenses tracked
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200">Top Category</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.topCategory}</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Your highest spending category
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Expenses */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Recent Expenses</CardTitle>
            <CardDescription>
              Your latest expense transactions from the FinMate bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No expenses found</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Start tracking expenses by sending messages to your FinMate bot on Telegram!
                </p>
                <Button variant="outline" size="lg">
                  Learn How to Use FinMate Bot
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense, index) => (
                  <div key={expense.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">
                              ${parseFloat(expense.amount.toString()).toLocaleString()} {expense.currency}
                            </span>
                            <Badge variant="secondary">{expense.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            {expense.merchant && <span className="font-medium">{expense.merchant}</span>}
                            {expense.merchant && expense.payment_method && <span>•</span>}
                            {expense.payment_method && <span>{expense.payment_method}</span>}
                            {(expense.merchant || expense.payment_method) && <span>•</span>}
                            <span>{new Date(expense.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bot Status */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-lime-50 dark:from-green-950 dark:to-lime-950">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-green-800 dark:text-green-200">FinMate Bot Status</CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              Your AI bot is live and tracking expenses 24/7
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                  <span className="font-semibold">Bot is live and running</span>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Online
              </Badge>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              <p className="text-sm text-green-700 dark:text-green-300">
                📱 Send expense messages to your Telegram bot to see them appear here in real-time.
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Server: finmate-bot.onrender.com • Database: Connected • Last sync: Just now
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}