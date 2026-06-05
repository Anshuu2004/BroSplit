<div align="center">

# 💸 BroSplit — Mobile-First Expense Splitter

![Next.js](https://img.shields.io/badge/Next.js%2015-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

**Split expenses across groups and trips — multi-currency, exact to the rupee, with real authorization.**

<!-- Hero image: add a screenshot of the group balances / add-expense screen, save it as docs/screenshot.png, then uncomment the next line: -->
<!-- ![BroSplit screenshot](docs/screenshot.png) -->

</div>

> **Highlights** — multi-currency balances (never auto-converted) · greedy debt simplification · **integer-exact money math** · Postgres **Row-Level Security** as source of truth · unit-tested algorithms (Vitest)

---

Mobile-first expense splitter for friends, roommates, and trips. Built per the PRD in `compass_artifact_wf-c445d463-0d2c-4d2d-bd57-18752d542bd5_text_markdown.md`.

## What's in the box

- **Auth** — email + password via Supabase Auth, session in HTTP-only cookies.
- **Groups** — create, invite via 7-day link, join via token, settings, admin remove with balance-warning gate.
- **Expenses** — integer-only amounts, 2-step add flow, deterministic remainder split (sorted by UUID).
- **Repayments** — debtor requests one or many; creditor accepts or rejects. No one-sided settle.
- **Multi-currency** — balances tracked per `(group, currency, user)`; never auto-converted.
- **Debt simplification** — greedy max-creditor / max-debtor, run independently per currency.
- **Notifications** — in-app feed with unread badge; expense-added trigger fans out to participants.
- **Profile** — per-currency totals and a drill-down of who owes you / who you owe by group.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui-style primitives · Supabase (Postgres + Auth + Realtime-ready) · React Hook Form + Zod · Vitest.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

- Go to [supabase.com](https://supabase.com) and create a new project.
- In the SQL editor, run each migration in order:

  1. `supabase/migrations/0001_init.sql`
  2. `supabase/migrations/0002_rls.sql`
  3. `supabase/migrations/0003_rpc.sql`
  4. `supabase/migrations/0004_triggers.sql`

  Or use the Supabase CLI: `supabase db push --linked`.

### 3. Configure env

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # server-only, never expose
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, create a group, invite a friend, add an expense, and settle up.

## Scripts

| Script              | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Next.js dev server                        |
| `npm run build`     | Production build                          |
| `npm run start`     | Run the production build                  |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm run lint`      | `next lint`                               |
| `npm run test`      | Run Vitest unit tests                     |
| `npm run db:types`  | Regenerate `src/types/database.ts` (CLI)  |

## Project structure

```
src/
  app/                   Next.js App Router
    (auth)/              public auth pages
    (app)/               authenticated app shell
      groups/[id]/       balances · expenses · history · settle · settings
      profile/           per-currency totals + drill-down
      notifications/     feed with accept/reject for repayment requests
    join/[token]/        invite redemption
    auth/signout/        POST → sign out
  components/            UI primitives + feature components
  lib/
    algos/               splitEqual, simplifyDebts, netBalance
    supabase/            client, server, middleware
    currency.ts          symbols, formatting, integer step
    validators.ts        Zod schemas (shared client/server)
  middleware.ts          session refresh + auth gate
  types/database.ts      hand-maintained DB types (regen via `db:types`)
supabase/migrations/     schema · RLS · RPCs · triggers
tests/unit/              algorithm tests
```

## Money math

Amounts are `BIGINT` integers, never floats. The split RPC and the client `splitEqual` use the same rule: integer division for the base, distribute the remainder one unit at a time to the first R participants in **ascending UUID order**. Both sides agree, so re-runs and verifications produce identical shares.

Balances are aggregated by the `group_balances` view (`paid − owed + repaid − received`), grouped by `(group_id, currency, user_id)`. There is no cross-currency arithmetic — multi-currency groups show one balance row per currency.

## Authorization

Postgres RLS is the source of truth; the app layer is defense-in-depth. Every table has explicit policies (see `0002_rls.sql`). Sensitive multi-row operations go through `SECURITY INVOKER` RPCs that re-check membership and admin role.

## What's intentionally not in MVP

Tracked in §18 of the PRD: receipt OCR, recurring expenses, dark-mode toggle, push notifications, optional FX conversion (snapshot rate), 1:1 friends outside groups, splits other than equal, multilingual UI, native wrapper. Realtime notifications via Supabase Realtime are wired in the schema/RLS and ready to plug in client-side.

## Testing

```bash
npm run test
```

Algorithms (`splitEqual`, `simplifyDebts`, `netBalance`) have full unit coverage. Add Playwright for end-to-end critical flows in Phase 2 (per the PRD).
