"use client"

import React, { useEffect, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Theme context/types
export type ThemeMode = 'light' | 'dark' | 'system'
type ThemeContextValue = { theme: ThemeMode; setTheme: (t: ThemeMode) => void }
const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [mounted, setMounted] = useState(false)

  // Load saved theme once
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved)
      }
    } catch {}
    setMounted(true)
  }, [])

  // Apply theme to <html> and persist
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    const apply = () => {
      if (theme === 'dark') {
        root.classList.add('dark')
      } else if (theme === 'light') {
        root.classList.remove('dark')
      } else {
        const m = window.matchMedia('(prefers-color-scheme: dark)')
        if (m.matches) root.classList.add('dark')
        else root.classList.remove('dark')
      }
    }
    apply()
    try { localStorage.setItem('theme', theme) } catch {}

    // React to system changes when in system mode
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') {
        if (m.matches) root.classList.add('dark')
        else root.classList.remove('dark')
      }
    }
    m.addEventListener?.('change', onChange)
    return () => m.removeEventListener?.('change', onChange)
  }, [theme, mounted])

  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  )
}
