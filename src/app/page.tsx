'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase, type Expense } from "@/lib/supabase"
import { useEffect, useState } from "react"

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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FinMate Dashboard</h1>
          <p className="text-muted-foreground">Your AI-powered expense tracker insights</p>
        </div>
        <Button variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.total.toLocaleString()} COP
            </div>
            <p className="text-xs text-muted-foreground">
              Last 10 transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.count}</div>
            <p className="text-xs text-muted-foreground">
              Recent expenses tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topCategory}</div>
            <p className="text-xs text-muted-foreground">
              Your most spending category
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>
            Your latest expense transactions from the FinMate bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No expenses found</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking expenses by sending messages to your FinMate bot on Telegram!
              </p>
              <Button variant="outline">
                Learn How to Use FinMate Bot
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        ${parseFloat(expense.amount.toString()).toLocaleString()} {expense.currency}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        • {expense.category}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {expense.merchant && <span>{expense.merchant} • </span>}
                      {expense.payment_method && <span>{expense.payment_method} • </span>}
                      {new Date(expense.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{expense.category}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bot Status */}
      <Card>
        <CardHeader>
          <CardTitle>FinMate Bot Status</CardTitle>
          <CardDescription>
            Your AI bot is live and tracking expenses 24/7
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="font-medium">Bot is live and running</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Send expense messages to your Telegram bot to see them appear here in real-time.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}