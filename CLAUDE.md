# FinMate Dashboard - Claude Memory

## Project Overview
FinMate dashboard is a Next.js web app with shadcn/ui components that displays AI-powered expense tracking insights from a Telegram bot connected to Supabase.

## Tech Stack
- **Framework**: Next.js 15.5.2 with React 19.1.0
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Supabase
- **Icons**: Lucide React
- **State Management**: React hooks (useState, useEffect)
- **Color System**: OKLCH color values

## Key Features
- Real-time expense tracking from Telegram bot
- Dashboard top-row metrics:
  - Total Net Worth (sum of `accounts.starting_balance`)
  - Total Monthly Expenses (current month; `expenses.entry_type` = "expense")
  - Total Monthly Available (`monthlyIncome - monthlyExpenses - expectedBudget`)
  - Finance Health Monitor (reserved; UI placeholder)
- Recent expenses list with merchant and payment method details
- Bot status monitoring with server health indicators
- Dark/light/system theme support
- Responsive design

- Aggregations use UTC month boundaries (`[YYYY-MM-01T00:00:00.000Z, month-endT23:59:59.999Z]`).
- Income/expense split is driven by `expenses.entry_type` in ["income","INCOME","expense","EXPENSE"].
- Currency display uses `$` (assumes unified currency; no FX normalization yet).

## Supabase Tables Confirmed
- `expenses`: includes `entry_type` (income/expense), `income_source`, `account` in addition to standard fields.
- `accounts`: includes `starting_balance` used as baseline for Net Worth.
- `budgets`, `budget_items`: exist; may be empty. When populated, expected budget is auto-detected.

## Metrics Implementation Details
- Monthly Expenses: sum of `amount` where `entry_type` ∈ {expense, EXPENSE} and `created_at` within current UTC month.
- Monthly Income: sum of `amount` where `entry_type` ∈ {income, INCOME} and `created_at` within current UTC month.
- Net Worth: sum of `accounts.starting_balance` (can be refined to include liabilities/positions later).
- Expected Budget: attempts to sum one of `planned_amount` | `amount` | `expected_amount` from `budget_items`, falling back to `budgets`; defaults to `0` if none found.

## Database Schema
- **Table**: `expenses`
  - Key fields: `id`, `amount`, `currency`, `merchant`, `category`, `payment_method`, `description`, `date`, `created_at`, `user_id`, `entry_type` ("income" | "expense"), `account`, `income_source`
- **Table**: `accounts`
  - Key fields: `id`, `name`, `type`, `currency`, `starting_balance`, `is_credit_card`, `created_at`
- **Tables**: `budgets`, `budget_items` (optional; may be empty)
  - Expected numeric fields (auto-detected): `planned_amount` | `amount` | `expected_amount`

## Current Color Scheme (OKLCH)
The dashboard uses a modern OKLCH color system defined in `src/app/globals.css`:

### Light Theme
```css
--radius: 0.65rem;
--background: oklch(1 0 0);
--foreground: oklch(0.141 0.005 285.823);
--primary: oklch(0.623 0.214 259.815);
--secondary: oklch(0.967 0.001 286.375);
--muted: oklch(0.967 0.001 286.375);
--border: oklch(0.92 0.004 286.32);
```

### Dark Theme
```css
--background: oklch(0.141 0.005 285.823);
--foreground: oklch(0.985 0 0);
--primary: oklch(0.546 0.245 262.881);
--card: oklch(0.21 0.006 285.885);
```

## Component Structure
The dashboard follows exact shadcn/ui patterns:

### Layout
- Sticky header (`h-16`)
- Flexbox main layout (`flex min-h-screen w-full flex-col`)
- Responsive grid system (`md:grid-cols-2 lg:grid-cols-4`)

### Key Components
1. **Stats Cards**: 4-card grid showing Total Net Worth, Total Monthly Expenses, Total Monthly Available, Finance Health Monitor
2. **Recent Expenses**: Large card (`xl:col-span-2`) with transaction list
3. **Bot Status**: Right sidebar with server status, connection info, and instructions

## Important Bot Status Features
- Green pulsing dot for online status (`bg-emerald-500 animate-pulse`)
- Server URL: `finmate-bot.onrender.com`
- Database status: Connected to Supabase
- Last sync indicator
- Telegram usage instructions

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## File Structure
- `src/app/page.tsx` - Main dashboard component
- `src/app/globals.css` - Global styles with OKLCH colors
- `src/components/ui/` - shadcn/ui components (card, button, badge, etc.)
- `src/lib/supabase.ts` - Supabase client and types

## Theme Implementation
- Theme state managed with useState
- Manual DOM manipulation for theme switching
- System preference detection with matchMedia API
- Three modes: light, dark, system

## Responsive Breakpoints
- Mobile: Default
- Tablet: `md:` (768px+)
- Desktop: `lg:` (1024px+)
- Large: `xl:` (1280px+)

## shadcn/ui Conventions Used
- Proper card structure with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- Consistent typography classes (`text-sm font-medium`, `text-2xl font-bold`)
- Standard spacing patterns (`space-y-8`, `gap-4 md:gap-8`)
- Accessibility attributes (`x-chunk`, `sr-only`)
- Empty state patterns with dashed borders

## Notes for Future Updates
- Always maintain shadcn/ui component structure
- Keep bot status monitoring features intact
- Preserve OKLCH color system
- Maintain responsive design patterns
- Test theme switching functionality

## Recent Changes
- UI: Header title alignment fixed — "FinMate Dashboard" now left-aligned; actions sit on the right.
- Error UX: Added clear inline alert for Supabase fetch failures and improved console messages.
- Supabase Guard: `SUPABASE_CONFIGURED` exported from `src/lib/supabase.ts`; fetch short-circuits when env vars are missing.
- Env Setup: `.env` and `.env.local` supported. Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client; keep server-only vars without NEXT_PUBLIC.
- Colors: Added missing `--destructive-foreground` token in light/dark themes.
- Tailwind Mapping: Switched Tailwind color config to read raw CSS variables (`var(--...)`) for OKLCH compatibility instead of `hsl(var(--...))`.
- Dev Server: Defaults to port 3000; if busy, we use 3001.
- Dashboard Metrics: Replaced first-row cards with Net Worth, Monthly Expenses, Monthly Available, and Health Monitor placeholder while preserving shadcn/ui design.
- Supabase Aggregates: Monthly income/expenses read from `expenses` by `entry_type`; net worth from `accounts.starting_balance`; expected budget auto-detected from `budget_items`/`budgets` if present.
- Type Safety: Removed `any` usage in metric reducers; added lightweight row types and safe Record indexing to satisfy ESLint (`@typescript-eslint/no-explicit-any`).
- Build: Fixed Vercel lint failures by enforcing explicit types in `src/app/page.tsx`.

## Environment Variables
Create `.env.local` for local development (not committed):

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
# Optional server-side only
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_DB_PASSWORD=<your-db-password>
```

`.gitignore` excludes `.env*` by default.
