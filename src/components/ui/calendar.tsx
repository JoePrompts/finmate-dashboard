"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Minimal DateRange type compatible with our usage
export type DateRange = { from?: Date; to?: Date }

type CalendarProps = {
  mode?: "range"
  selected?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  defaultMonth?: Date
  numberOfMonths?: number
  initialFocus?: boolean
  className?: string
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBefore(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime()
}

function isBetweenInclusive(d: Date, a?: Date, b?: Date) {
  if (!a || !b) return false
  const x = startOfDay(d).getTime()
  const lo = Math.min(startOfDay(a).getTime(), startOfDay(b).getTime())
  const hi = Math.max(startOfDay(a).getTime(), startOfDay(b).getTime())
  return x >= lo && x <= hi
}

function Calendar({ className, defaultMonth, selected, onSelect }: CalendarProps) {
  const today = startOfDay(new Date())
  const [month, setMonth] = React.useState<Date>(() => startOfDay(defaultMonth || selected?.from || today))

  React.useEffect(() => {
    if (defaultMonth) setMonth(startOfDay(defaultMonth))
  }, [defaultMonth])

  function addMonths(d: Date, delta: number) {
    const m = new Date(d)
    m.setMonth(m.getMonth() + delta)
    return startOfDay(m)
  }

  function getGrid(monthDate: Date) {
    // Start at first day of month
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const firstWeekday = first.getDay() // 0=Sun
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - firstWeekday)
    const days: { date: Date; outside: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      days.push({ date: startOfDay(d), outside: d.getMonth() !== monthDate.getMonth() })
    }
    return days
  }

  const days = getGrid(month)

  function handleClick(day: Date) {
    const from = selected?.from
    const to = selected?.to
    if (!from || (from && to)) {
      onSelect?.({ from: day, to: undefined })
    } else {
      if (isBefore(day, from)) {
        onSelect?.({ from: day, to: from })
      } else {
        onSelect?.({ from, to: day })
      }
    }
  }

  return (
    <div className={cn("p-3", className)}>
      <div className="flex items-center justify-center relative py-1">
        <button
          type="button"
          aria-label="Previous month"
          className="absolute left-1 h-7 w-7 rounded hover:bg-accent text-muted-foreground"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <ChevronLeft className="h-4 w-4 mx-auto" />
        </button>
        <div className="text-sm font-medium">
          {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          aria-label="Next month"
          className="absolute right-1 h-7 w-7 rounded hover:bg-accent text-muted-foreground"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <ChevronRight className="h-4 w-4 mx-auto" />
        </button>
      </div>
      <div className="w-full">
        <div className="flex text-[0.8rem] text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={`${d}-${i}`} className="w-9 text-center">{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7">
          {days.map(({ date, outside }, idx) => {
            const inRange = isBetweenInclusive(date, selected?.from, selected?.to)
            const isStart = selected?.from && isSameDay(date, selected.from)
            const isEnd = selected?.to && isSameDay(date, selected.to)
            const isToday = isSameDay(date, today)
            const base = "h-9 w-9 m-0.5 text-sm inline-flex items-center justify-center rounded-md"
            const outsideCls = outside ? "text-muted-foreground/70" : ""
            const todayCls = isToday ? "bg-accent text-accent-foreground" : ""
            const selectedCls = inRange
              ? (isStart || isEnd)
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground"
              : "hover:bg-accent"
            return (
              <button
                key={idx}
                type="button"
                data-selected={inRange ? true : undefined}
                className={cn(base, outsideCls, todayCls, selectedCls)}
                onClick={() => handleClick(date)}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
