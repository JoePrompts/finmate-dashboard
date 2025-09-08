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
- Collapsible left sidebar (shadcn sidebar-07) with icon-only collapse
- Dashboard top-row metrics:
  - Total Net Worth (sum of `accounts.starting_balance`)
  - Total Monthly Expenses (current month; `expenses.entry_type` = "expense")
  - Total Monthly Available (`monthlyIncome - monthlyExpenses - expectedBudget`)
  - Finance Health Monitor (reserved; UI placeholder)
- Recent transactions list (last 5) with category icons, merchant title, date subtitle, signed amount with currency and directional arrow (↗ income, ↘ expense). A full-width “View All” button at the bottom navigates to `/transactions` via SPA (Next Link) with a subtle hover animation.
- USD→COP hover tooltip for currency conversion (animated)
- Account Balances card with icons and per-account currency tooltips (AstroPay + USD accounts)
- Credit Cards card with debt totals in COP (USD purchases converted)
- Bot status monitoring with server health indicators
- Dark/light/system theme support
- Responsive design

- Aggregations use UTC month boundaries (`[YYYY-MM-01T00:00:00.000Z, month-endT23:59:59.999Z]`).
- Income/expense split is driven by `expenses.entry_type` in ["income","INCOME","expense","EXPENSE"].
- Currency: `$` before numbers and 3-letter code after (e.g., `$1,234 USD`).
- Credit Cards: amounts always displayed as negative and in COP (e.g., `-$1,234 COP`).

## Supabase Tables Confirmed
- `expenses`: includes `entry_type` (income/expense), `income_source`, `account` in addition to standard fields.
- `accounts`: includes `starting_balance` used as baseline for Net Worth.
- `budgets`, `budget_items`: exist; may be empty. When populated, expected budget is auto-detected.

## Metrics Implementation Details
- Monthly Expenses: sum of `amount` where `entry_type` ∈ {expense, EXPENSE} and `created_at` within current UTC month.
- Monthly Income: sum of `amount` where `entry_type` ∈ {income, INCOME} and `created_at` within current UTC month.
- Net Worth: sum of `accounts.starting_balance` (can be refined to include liabilities/positions later).
- Expected Budget: attempts to sum one of `planned_amount` | `amount` | `expected_amount` from `budget_items`, falling back to `budgets`; defaults to `0` if none found.

## Transactions, Accounts, and Cards Logic
- Recent Transactions:
  - Title: merchant; Subtitle: formatted date.
  - Left icon: selected by category mapping (groceries, dining, travel, etc.).
  - Right value: signed amount with currency and directional arrow (↗ income green, ↘ expense custom red tone `rgb(248 113 113 / var(--tw-text-opacity, 1))`).
  - USD currency shows a hover tooltip with converted COP using live FX.
- Account Balances:
  - For each non-credit account, the displayed amount = starting balance + net sum of its transactions in the same currency.
  - Matching uses case-insensitive substring of `expenses.payment_method` against account name (both directions).
  - Subtitle shows account currency; USD and “AstroPay” accounts show the hover conversion tooltip.
- Credit Cards:
  - Debt is computed from expenses only, converted to COP: each transaction signed by `entry_type` and converted USD→COP.
  - If no transactions match a card name yet, we fallback to the stored balance converted to COP.
  - Display format: always negative, `$` symbol before the number and `COP` after (no red color).

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
2. **Recent Transactions**: Card with iconized rows and currency/FX tooltip
3. **Account Balances**: Card listing accounts with icons, subtitles, and tooltips for USD/AstroPay
4. **Credit Cards**: Card listing card debts in COP only
5. **Bot Status**: Moved to bottom section with server status, connection info, and instructions

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
 - `src/app/layout.tsx` - Sidebar + providers (TooltipProvider, React Query)
 - `src/app/providers.tsx` - React Query provider
 - `src/components/app-sidebar.tsx` and `src/components/ui/sidebar.tsx` - Sidebar integration (sidebar-07)

## Theme Implementation
- Theme state managed with useState
- ThemeProvider centralizes theme switching, applies the `dark` class to `<html>`, persists to `localStorage`, and listens to system changes when in `system` mode.
- System preference detection with `matchMedia` when in `system` mode
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
- Sidebar: Installed and integrated shadcn `sidebar-07` preset; wired into global layout.
- Recent Transactions: Renamed section, added category icons, merchant/date layout, signed amounts, and directional arrows; adjusted expense red to `rgb(248 113 113 / var(--tw-text-opacity, 1))`.
- FX Tooltip: Added animated USD→COP tooltip on hover using shadcn Tooltip + React Query; shared cache; also used for AstroPay and USD accounts.
- tailwindcss-animate: Installed and enabled for shadcn animations; wrapped app with `TooltipProvider`.
- Account Balances: New card with icons and subtitles; amounts now computed as starting balance + net same-currency transactions.
- Credit Cards: New card with icons and subtitles; debt computed from transactions converted to COP (USD purchases converted). Always shown as negative, format `$1,234 COP` with leading minus.
- Bot Status: Moved to bottom section to make room for the two new cards.
- Lint/Build: Fixed ESLint issues (empty object type, unused imports) and ensured type checks pass on Vercel.
- Theme: Centralized theme logic into a ThemeProvider; fixed persistence so saved preference isn’t clobbered on first mount; listens to system changes in `system` mode.
- Dashboard → Recent Transactions: Limited to last 5 items, moved “View All” to the bottom as a full-width button with hover animation; uses Next.js `Link` for SPA navigation to `/transactions`.

### New Transactions Page
- Route: `/transactions` with a simple header (SidebarTrigger + title) and persistent Refresh and Theme settings controls.
- Theme persistence: Managed by ThemeProvider — preference stored in `localStorage`, applied globally, and reacts to system changes when in `system` mode.
- Data table: Full transaction list with columns: Merchant, Amount (signed; expense red), Date, Account, Credit (Yes/No), Category, Type.
  - Currency column removed; amount shows symbol and, for USD, an inline “USD” tooltip that converts to COP with live FX (open.er-api.com) — same behavior as Dashboard.
  - Row spacing increased for readability; table header has a contrasting background (`bg-muted` with `overflow-hidden` container) to preserve rounded corners.
  - Sorting: Primarily by transaction date (descending by day), with a tie‑breaker on `created_at` so the most recently added shows first for the same day.
  - Pagination: Shows 10 rows per page with shadcn‑style pagination controls (Previous, numbers, Next) centered below the table.
  - Alignment/stability: Fixed table layout with explicit column widths, `tabular-nums` for amounts, truncation for long text, and `scrollbar-gutter: stable` to prevent layout shift.
  - Details Sheet: A rightmost Eye icon opens a shadcn Sheet per row with:
    - Summary: amount (income green/expense red), local date/time, account, credit flag, category, type, full description.
    - Database Fields: raw fields from Supabase including `id`, `amount`, `currency`, `merchant`, `category`, `payment_method`, `account` (if present), `entry_type` (if present), `description` (full, wrapped), `date`, `created_at`, `user_id`, `edited`, `edited_at`, `updated_at` when present.
    - Edit History: renders `edit_history` (if present) as pretty JSON or raw text in a scrollable block.
    - Raw Record: pretty‑printed JSON of the entire row for debugging.
    - UX: Wider sheet on `sm+` (640px), vertical scroll enabled; content uses tight grid, no truncation for long text blocks.

### Sidebar Navigation
- Added a new “Developing” group at the top with links to `Dashboard` (`/`) and `Transactions` (`/transactions`).
- Sidebar header simplified for single-user: shows FinMate brand (icon + title + subtitle) using `TeamSwitcher` in single-person mode.

### Dashboard Header
- Title simplified to “Dashboard” (removed “FinMate” prefix).
- Consistent Refresh and Theme controls retained.

## Data Access and Endpoints
- Supabase client-side queries are used directly via `@supabase/supabase-js`. No custom API endpoints were added; RLS governs access.
- External FX API: `https://open.er-api.com/v6/latest/USD` is called client-side to resolve USD→COP. Results are cached for 5 minutes with React Query.

## Matching Heuristics
- Accounts and cards are matched to transactions using `expenses.payment_method` compared to the account/card name (case-insensitive, substring either way). An alias map can be added if needed to improve matching.

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
