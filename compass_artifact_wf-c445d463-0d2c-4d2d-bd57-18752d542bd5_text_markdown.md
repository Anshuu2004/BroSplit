# Brosplit — Product Requirements Document & Implementation Plan

**Version:** 1.0
**Date:** May 2026
**Document type:** PRD + Engineering Implementation Plan
**Author:** Product / Engineering

---

## 1. Executive Summary

### 1.1 Product Vision
**Brosplit** is a mobile-first, web-based expense-splitting application that lets friends, roommates, travel groups, and small communities track shared expenses, automatically calculate who owes whom, and settle up with a confirmable repayment workflow. It is designed to be the lightest, fastest, most friction-free alternative to Splitwise — built for real-world group situations where money is messy, currencies are mixed, and trust matters.

### 1.2 Target Users
- **College students & roommates** — splitting rent, groceries, utilities.
- **Friends on trips** — domestic and international, mixed currencies.
- **Small social groups** — dinner clubs, sports teams, hobby groups.
- **Young professionals** — sharing apartments, gifts, recurring bills.

### 1.3 Key Differentiators vs. Splitwise
| Feature | Splitwise (Free) | Brosplit |
|---|---|---|
| Daily expense limit | 3–4 per day on free tier | **Unlimited (always free in MVP)** |
| Repayment confirmation | One-sided "marked as settled" | **Two-sided request → accept handshake** |
| Admin moderation | Anyone can edit anyone's expenses | **Group creator is admin; can remove members with a balance-warning gate** |
| Decimal handling | Floats with rounding "drift" issues | **Strict integer-only amounts → deterministic, audit-friendly** |
| Multi-currency | Pro-only conversion | **Per-currency tracked balances built into MVP** |
| Mobile install | Native apps + web | **PWA-first; one codebase, instant install** |
| Cost | Pro at ~$3/month | **Free, low-cost hosting (Supabase + Vercel free tier)** |

### 1.4 Why "integer-only + multi-currency + simplification" matter together
The combination is non-trivial: rounding remainders must be assigned **deterministically per expense** (not at settlement time), per-currency ledgers must be kept **independent** (never cross-converted in MVP without explicit user FX rates), and the debt-simplification algorithm must run **per currency, per group**. We address this explicitly in §8.

---

## 2. Problem Statement & User Stories

### 2.1 Problem Statement
Splitting expenses among groups is a perennial source of awkwardness, math errors, and forgotten debts. Existing tools either gate basic functionality behind paywalls (Splitwise), don't enforce confirmation of repayments (creating "I paid you back" disputes), use floating-point math that drifts over many small expenses, or don't gracefully handle multi-currency travel scenarios.

### 2.2 User Stories

**Authentication & Profile**
- As a new user, I want to sign up with my full name, email, and password so that I can start using Brosplit.
- As a returning user, I want to log in securely and stay logged in on my phone browser.
- As a user, I want to see my total amount lent and total amount owed at a glance, and tap into either to see the breakdown.

**Group Management**
- As a user, I want to create a group with a name and become its admin.
- As an admin, I want to share an invite link so anyone in my group chat can join with one tap.
- As an admin, I want to remove a member, but be warned if they have a pending balance.
- As a user, I want to delete a group I created when we're done with it.

**Expenses**
- As a group member, I want to add a shared expense, name it, and pick who participated, then split the cost evenly in a single tap.
- As a participant, I want the math to always be exact — no floating-point surprises.
- As a traveling group, I want to record expenses in different currencies in the same trip group without losing track.

**Repayments**
- As a debtor, I want to send a repayment request to one or many lenders at once.
- As a lender, I want to confirm or reject the repayment so my records stay accurate.
- As a user, I want a history of settled repayments separate from active balances.

**Notifications & Visibility**
- As a user, I want to see all relevant activity (invitations, new expenses, repayment requests, removals) in one place when I open the app.
- As a group member, I want full visibility into who owes whom in my group.

---

## 3. Functional Requirements

### 3.1 Authentication
| FR-ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-A1 | Sign-up with full name, email, password | Email is unique; passwords ≥8 chars with at least 1 letter and 1 digit; email format validated; duplicate email returns 409 |
| FR-A2 | Email is the unique user identifier | Email is `CITEXT UNIQUE NOT NULL` in DB |
| FR-A3 | Secure login | Session token (HTTP-only, Secure, SameSite=Lax cookie); failed-login rate limit 5 per IP per 15 min |
| FR-A4 | Logout | Server-side session/JWT invalidation |
| FR-A5 | Password reset (Phase 2) | Email magic link with 30-min expiry |

### 3.2 Group Management
| FR-ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-G1 | Create group with a name; minimum 2 members | Creator auto-added as admin; name 1–50 chars |
| FR-G2 | Admin generates invite link | Token-based URL `/join/{token}`; expires in 7 days; one-time-or-multi-use configurable |
| FR-G3 | Anyone with link can join | Auto-add as member if logged in; redirect to login if not |
| FR-G4 | Admin removes a member | If member has nonzero balance in any currency, show modal: "X owes ₹Y / is owed ₹Z. Removing them will delete those records. Continue?" |
| FR-G5 | User deletes their own group | Only group admin can delete; soft-delete with 7-day grace |
| FR-G6 | Member visibility | All members see all expenses, splits, and balances in the group |

### 3.3 Expense Splitting
| FR-ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-E1 | Add expense with **integer-only** amount | Reject non-integer input at form level (`type=number`, `step=1`, regex `^\d+$`) and DB level (`CHECK (amount > 0)` on `BIGINT`) |
| FR-E2 | Expense name | 1–100 chars, required |
| FR-E3 | Currency selector per expense | ISO-4217 code; defaults to group's primary currency |
| FR-E4 | Participant selector | All members pre-selected; user can deselect including themselves; ≥1 participant required |
| FR-E5 | Equal split with deterministic remainder | See §8.1 algorithm |
| FR-E6 | Net balance recompute | After each expense, group's balances per currency are recomputed |
| FR-E7 | Edit/delete expense | Only the creator (and admin) can edit/delete; deletion reverses splits |

### 3.4 Repayment Flow
| FR-ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-R1 | Repay one or many lenders in one action | UI shows simplified-debt list of lenders, user picks ≥1, enters amount per lender + description |
| FR-R2 | Repayment is a **request**, not auto-applied | Created with status `PENDING` |
| FR-R3 | Lender accepts/rejects | On accept → status `ACCEPTED`, balance updated; on reject → `REJECTED`, no effect |
| FR-R4 | Settled repayments removed from active balances but retained in history | A `settled_at` timestamp marks closure |
| FR-R5 | Idempotency | Duplicate-submit prevention via client-generated UUID idempotency key |

### 3.5 Notifications
| FR-ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-N1 | In-app notification feed | Loaded on app open; unread badge count |
| FR-N2 | Triggers | Group invite, joined group, expense added, expense edited/deleted, repayment requested, repayment accepted/rejected, removed from group, new member joined |
| FR-N3 | Mark as read | On individual click and bulk "mark all" |
| FR-N4 | Realtime updates (Phase 2) | Supabase Realtime subscription pushes new notifications |

### 3.6 Profile
| FR-ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-P1 | Show total lent and total owed | Aggregated **per currency** (e.g., "You are owed ₹2,400 + $50; you owe €30") |
| FR-P2 | Drill-down | Tapping a total shows list with: counterparty name, group name, expense name, amount, currency, date |

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | First Contentful Paint < 1.8s on 4G mobile; Time to Interactive < 3s; API responses p95 < 400 ms |
| **Bundle size** | Initial JS payload < 200 KB gzipped (route-split with App Router) |
| **Mobile responsive** | Tested on 360×640 (smallest), 390×844 (iPhone), 412×915 (Pixel); tap targets ≥44×44 px |
| **Security** | OWASP Top-10 baseline; HTTPS only; HSTS; CSP; rate limiting; RLS at DB layer |
| **Availability** | 99.5% (best-effort on free tier) |
| **Scalability** | Tens of thousands of users on Supabase free tier with proper indexes |
| **Accessibility** | WCAG 2.1 AA: color contrast ≥4.5:1, keyboard navigation, ARIA labels, screen-reader semantics |
| **Internationalization** | i18n-ready folder structure (English MVP; Hindi, Spanish, French in roadmap) |
| **Browser support** | Last 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari ≥15 |
| **Offline** | PWA with service worker caching of shell + last-seen group data (read-only when offline) |

---

## 5. User Flows

### 5.1 Sign-up
1. User opens `/signup`.
2. Enters Full Name, Email, Password.
3. Client-side Zod validation runs.
4. POST to Supabase Auth → creates auth row → trigger creates `users` row.
5. JWT stored in HTTP-only cookie via `@supabase/ssr`.
6. Redirect to `/groups` (empty state).

### 5.2 Login
1. `/login` → email + password → Supabase Auth `signInWithPassword`.
2. On success, cookie set, redirect to `/groups`.
3. On failure, generic error "Invalid credentials" (no user enumeration).

### 5.3 Group Creation
1. From `/groups`, tap **+ New Group**.
2. Enter group name, select primary currency (default INR).
3. Server inserts `groups` row, creator added to `group_members` with role `admin`.
4. Redirect to `/groups/{id}` with empty state and **Invite** button.

### 5.4 Joining via Invite
1. User taps invite link `/join/{token}`.
2. If not logged in → redirect to `/login?next=/join/{token}`.
3. Server validates token (not expired, not revoked).
4. Inserts `group_members` row; creates notification for admin.
5. Redirect to group page.

### 5.5 Adding & Splitting Expense
1. In group, tap **+ Add Expense**.
2. Screen 1: amount (integer only), expense name, currency.
3. Tap **Next** → Screen 2: list of all members, all checked. User toggles.
4. Tap **Split** → server computes split (§8.1), inserts `expenses` and `expense_splits` rows.
5. Notifications fanned out to all participants.

### 5.6 Repaying
1. From group or profile, tap **Settle Up**.
2. UI shows simplified debts for that group (per currency).
3. User selects one or multiple lenders, fills amount + description per row.
4. Tap **Send Request** → creates `repayments` rows (status `PENDING`).
5. Notifications sent to selected lenders.

### 5.7 Accepting Repayment
1. Lender opens notifications; taps repayment request.
2. Modal shows debtor name, amount, description.
3. **Accept** → status `ACCEPTED`, `settled_at = now()`; balances recomputed.
4. **Reject** → status `REJECTED`; debtor notified.

### 5.8 Removing a Member
1. Admin opens group settings → member list.
2. Taps **Remove** next to a member.
3. Server returns balance summary for that member.
4. If nonzero, modal shows: "Anita owes ₹450 and is owed ₹120 in this group. Removing will delete these records. Continue?"
5. On confirm, member removed; their splits and pending repayments are reversed/voided.

### 5.9 Viewing Profile
1. Tap profile avatar → `/profile`.
2. Shows aggregated **per-currency** totals.
3. Tapping "You are owed ₹2,400" → list of all open lent positions, grouped by counterparty.

---

## 6. Database Schema (PostgreSQL / Supabase)

### 6.1 ERD overview
```
users ──< group_members >── groups
                              │
                              ├──< expenses ──< expense_splits >── users
                              │
                              ├──< repayments >── users (debtor / creditor)
                              │
                              └──< invite_links

users ──< notifications
```

### 6.2 CREATE TABLE statements

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive emails

------------------------------------------------------------
-- USERS  (mirrors auth.users; one row per signed-up user)
------------------------------------------------------------
CREATE TABLE public.users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           CITEXT UNIQUE NOT NULL,
    full_name       TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80),
    avatar_url      TEXT,
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON public.users (email);

------------------------------------------------------------
-- GROUPS
------------------------------------------------------------
CREATE TABLE public.groups (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    primary_currency   CHAR(3) NOT NULL DEFAULT 'INR',
    created_by         UUID NOT NULL REFERENCES public.users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_groups_created_by ON public.groups (created_by);

------------------------------------------------------------
-- GROUP_MEMBERS  (join table with role)
------------------------------------------------------------
CREATE TYPE group_role AS ENUM ('admin', 'member');

CREATE TABLE public.group_members (
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role        group_role NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at  TIMESTAMPTZ,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON public.group_members (user_id) WHERE removed_at IS NULL;

------------------------------------------------------------
-- INVITE_LINKS
------------------------------------------------------------
CREATE TABLE public.invite_links (
    token       TEXT PRIMARY KEY,                -- 32-char URL-safe random
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES public.users(id),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invite_group ON public.invite_links (group_id);

------------------------------------------------------------
-- EXPENSES   (the bill itself; integer-only amounts)
------------------------------------------------------------
CREATE TABLE public.expenses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    amount       BIGINT NOT NULL CHECK (amount > 0),  -- integer only
    currency     CHAR(3) NOT NULL,
    paid_by      UUID NOT NULL REFERENCES public.users(id),
    created_by   UUID NOT NULL REFERENCES public.users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_expenses_group ON public.expenses (group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_paid_by ON public.expenses (paid_by);

------------------------------------------------------------
-- EXPENSE_SPLITS   (one row per participant per expense)
------------------------------------------------------------
CREATE TABLE public.expense_splits (
    expense_id   UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES public.users(id),
    share        BIGINT NOT NULL CHECK (share >= 0),  -- integer
    is_remainder_payer BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (expense_id, user_id)
);
-- Invariant enforced at app layer: SUM(share) per expense_id == expenses.amount

------------------------------------------------------------
-- REPAYMENTS   (debtor → creditor with accept/reject flow)
------------------------------------------------------------
CREATE TYPE repayment_status AS ENUM ('PENDING','ACCEPTED','REJECTED','CANCELLED');

CREATE TABLE public.repayments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    debtor_id     UUID NOT NULL REFERENCES public.users(id),
    creditor_id   UUID NOT NULL REFERENCES public.users(id),
    amount        BIGINT NOT NULL CHECK (amount > 0),
    currency      CHAR(3) NOT NULL,
    description   TEXT,
    status        repayment_status NOT NULL DEFAULT 'PENDING',
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at    TIMESTAMPTZ,
    idempotency_key TEXT UNIQUE,
    CHECK (debtor_id <> creditor_id)
);
CREATE INDEX idx_repay_group_status ON public.repayments (group_id, status);
CREATE INDEX idx_repay_creditor ON public.repayments (creditor_id, status);
CREATE INDEX idx_repay_debtor ON public.repayments (debtor_id, status);

------------------------------------------------------------
-- NOTIFICATIONS
------------------------------------------------------------
CREATE TYPE notification_type AS ENUM (
  'GROUP_INVITE','GROUP_JOINED','GROUP_REMOVED','MEMBER_JOINED','MEMBER_REMOVED',
  'EXPENSE_ADDED','EXPENSE_EDITED','EXPENSE_DELETED',
  'REPAYMENT_REQUEST','REPAYMENT_ACCEPTED','REPAYMENT_REJECTED'
);

CREATE TABLE public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    payload     JSONB NOT NULL,        -- {group_id, expense_id, actor_id, amount, ...}
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
```

### 6.3 Trigger: auto-create profile on signup
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
    RETURN NEW;
END;$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 6.4 Helper: balance materialized view
```sql
-- Per-user, per-group, per-currency NET balance (positive = owed to user)
CREATE VIEW public.group_balances AS
WITH paid AS (
    SELECT e.group_id, e.currency, e.paid_by AS user_id, SUM(e.amount) AS total
    FROM expenses e WHERE e.deleted_at IS NULL GROUP BY 1,2,3
),
owed AS (
    SELECT e.group_id, e.currency, s.user_id, SUM(s.share) AS total
    FROM expenses e JOIN expense_splits s ON s.expense_id = e.id
    WHERE e.deleted_at IS NULL GROUP BY 1,2,3
),
repaid AS (
    SELECT group_id, currency, debtor_id AS user_id, SUM(amount) AS total
    FROM repayments WHERE status='ACCEPTED' GROUP BY 1,2,3
),
received AS (
    SELECT group_id, currency, creditor_id AS user_id, SUM(amount) AS total
    FROM repayments WHERE status='ACCEPTED' GROUP BY 1,2,3
)
SELECT
    COALESCE(p.group_id, o.group_id, r.group_id, rc.group_id) AS group_id,
    COALESCE(p.currency, o.currency, r.currency, rc.currency) AS currency,
    COALESCE(p.user_id, o.user_id, r.user_id, rc.user_id) AS user_id,
    COALESCE(p.total,0) - COALESCE(o.total,0)
        + COALESCE(r.total,0) - COALESCE(rc.total,0) AS net_balance
FROM paid p
FULL OUTER JOIN owed o USING (group_id, currency, user_id)
FULL OUTER JOIN repaid r USING (group_id, currency, user_id)
FULL OUTER JOIN received rc USING (group_id, currency, user_id);
```

### 6.5 Row-Level Security (RLS) policies

```sql
-- Helper function: is user a (non-removed) member of group?
CREATE OR REPLACE FUNCTION public.is_group_member(g UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = g AND user_id = auth.uid() AND removed_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(g UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = g AND user_id = auth.uid()
      AND role = 'admin' AND removed_at IS NULL);
$$;

-- Enable RLS on every table
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

-- USERS: a user can read their own row + minimal info of co-members
CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_co_member_read ON public.users
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = users.id
      AND gm1.removed_at IS NULL AND gm2.removed_at IS NULL));

CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- GROUPS: members can read; only admin can update/delete; any auth user can create
CREATE POLICY groups_member_read ON public.groups
  FOR SELECT USING (public.is_group_member(id));
CREATE POLICY groups_create ON public.groups
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY groups_admin_update ON public.groups
  FOR UPDATE USING (public.is_group_admin(id));
CREATE POLICY groups_admin_delete ON public.groups
  FOR DELETE USING (public.is_group_admin(id));

-- GROUP_MEMBERS: members can see member list; admin can insert/delete; user can leave
CREATE POLICY gm_read ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY gm_admin_write ON public.group_members
  FOR ALL USING (public.is_group_admin(group_id))
            WITH CHECK (public.is_group_admin(group_id));

-- EXPENSES: visible to all members; insert by members; edit/delete by creator or admin
CREATE POLICY exp_read ON public.expenses
  FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY exp_insert ON public.expenses
  FOR INSERT WITH CHECK (public.is_group_member(group_id) AND created_by = auth.uid());
CREATE POLICY exp_modify ON public.expenses
  FOR UPDATE USING (created_by = auth.uid() OR public.is_group_admin(group_id));
CREATE POLICY exp_delete ON public.expenses
  FOR DELETE USING (created_by = auth.uid() OR public.is_group_admin(group_id));

-- EXPENSE_SPLITS: piggyback on expense membership
CREATE POLICY es_read ON public.expense_splits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = expense_splits.expense_id
      AND public.is_group_member(e.group_id)));
CREATE POLICY es_write ON public.expense_splits
  FOR ALL USING (EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = expense_splits.expense_id
      AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = expense_splits.expense_id
      AND e.created_by = auth.uid()));

-- REPAYMENTS: visible to debtor, creditor, and group; only debtor creates;
--             only creditor accepts/rejects; debtor can cancel while PENDING
CREATE POLICY rp_read ON public.repayments
  FOR SELECT USING (debtor_id = auth.uid() OR creditor_id = auth.uid()
                    OR public.is_group_member(group_id));
CREATE POLICY rp_insert ON public.repayments
  FOR INSERT WITH CHECK (debtor_id = auth.uid()
                         AND public.is_group_member(group_id));
CREATE POLICY rp_update ON public.repayments
  FOR UPDATE USING (
    (creditor_id = auth.uid() AND status = 'PENDING')   -- accept/reject
    OR (debtor_id = auth.uid() AND status = 'PENDING')  -- cancel
  );

-- NOTIFICATIONS: only owner reads/marks read; service role inserts
CREATE POLICY notif_self ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INVITE_LINKS: admins manage; anyone authenticated can SELECT by token
-- (we instead expose a SECURITY DEFINER function consume_invite to avoid token enumeration)
CREATE POLICY inv_admin_all ON public.invite_links
  FOR ALL USING (public.is_group_admin(group_id))
            WITH CHECK (public.is_group_admin(group_id));
```

### 6.6 Server-side RPC for sensitive operations
For multi-row operations that must be atomic (creating expense + splits, accepting repayment, removing member with balance check), use Postgres functions:

```sql
CREATE OR REPLACE FUNCTION public.create_expense(
    p_group_id UUID, p_name TEXT, p_amount BIGINT,
    p_currency CHAR(3), p_paid_by UUID, p_participants UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_expense_id UUID;
    v_n INT := array_length(p_participants, 1);
    v_base BIGINT := p_amount / v_n;
    v_remainder INT := p_amount - v_base * v_n;
    v_uid UUID;
    v_idx INT := 0;
BEGIN
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member';
    END IF;
    IF v_n IS NULL OR v_n < 1 THEN
        RAISE EXCEPTION 'at least one participant required';
    END IF;

    INSERT INTO expenses (group_id, name, amount, currency, paid_by, created_by)
    VALUES (p_group_id, p_name, p_amount, p_currency, p_paid_by, auth.uid())
    RETURNING id INTO v_expense_id;

    FOREACH v_uid IN ARRAY p_participants LOOP
        INSERT INTO expense_splits (expense_id, user_id, share, is_remainder_payer)
        VALUES (v_expense_id, v_uid,
                v_base + CASE WHEN v_idx < v_remainder THEN 1 ELSE 0 END,
                v_idx < v_remainder);
        v_idx := v_idx + 1;
    END LOOP;

    RETURN v_expense_id;
END;$$;
```

---

## 7. API Design

Brosplit uses **Supabase JS client + Postgres RPC** as the primary data layer (no separate REST/GraphQL API needed in MVP). Below is the logical contract; transport is `supabase-js` calls or Next.js Route Handlers that wrap them.

### 7.1 Auth
| Operation | Mechanism |
|---|---|
| Sign up | `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` |
| Sign out | `supabase.auth.signOut()` |
| Get session | `supabase.auth.getUser()` (server-side) |

### 7.2 Groups
| Method | Path / RPC | Body | Response |
|---|---|---|---|
| POST | `/api/groups` (calls `groups.insert`) | `{ name, primary_currency }` | `Group` |
| GET | client query `from('groups').select(...)` | – | `Group[]` |
| DELETE | `/api/groups/:id` | – | `204` |
| POST | `/api/groups/:id/invite` | – | `{ url, expires_at }` |
| POST | `/api/groups/join` | `{ token }` | `Group` |
| POST | `/api/groups/:id/remove-member` | `{ user_id, confirm: bool }` | balance summary or `{ removed: true }` |

### 7.3 Expenses
| Method | Path / RPC | Body | Response |
|---|---|---|---|
| POST | RPC `create_expense` | `{ group_id, name, amount, currency, paid_by, participants[] }` | `expense_id` |
| PUT | `/api/expenses/:id` | edit fields | `Expense` |
| DELETE | `/api/expenses/:id` | – | `204` |
| GET | `from('expenses').select(...)` | filters | `Expense[]` |

### 7.4 Repayments
| Method | Path / RPC | Body | Response |
|---|---|---|---|
| POST | RPC `request_repayments` | `{ group_id, items: [{ creditor_id, amount, currency, description }], idempotency_key }` | `repayment_ids[]` |
| POST | RPC `accept_repayment` | `{ repayment_id }` | `{ status }` |
| POST | RPC `reject_repayment` | `{ repayment_id }` | `{ status }` |
| POST | RPC `cancel_repayment` | `{ repayment_id }` | `{ status }` |

### 7.5 Notifications
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `from('notifications').select(...).order('created_at',{ascending:false})` | – | `Notification[]` |
| POST | `/api/notifications/mark-read` | `{ ids: UUID[] \| 'all' }` | `204` |
| Realtime | `supabase.channel('notif:'+uid).on('postgres_changes', ...)` | – | push updates |

### 7.6 Profile / Balances
| Method | Path | Response |
|---|---|---|
| GET | `from('group_balances').select(...).eq('user_id', uid)` | `[{ group_id, currency, net_balance }, ...]` |
| GET | RPC `user_summary(uid)` | `{ totals: {currency: {lent, owed}}, breakdown: [...] }` |

---

## 8. Splitting Algorithm Logic

### 8.1 Equal split with deterministic integer remainder

**Problem:** Split integer `A` among `N` participants when `A mod N ≠ 0`. Example: ₹100 / 3 ⇒ shares 33, 33, **34**.

**Rule:** Distribute the remainder `R = A mod N` across the **first R participants in a deterministic order** (e.g., sorted by `user_id`). Mark them with `is_remainder_payer = true` so the UI can show "Anita pays ₹1 extra (rounding)".

**Pseudocode:**
```ts
function splitEqual(amount: bigint, participants: UUID[]): Split[] {
  if (amount <= 0n)  throw new Error("amount must be positive integer");
  if (participants.length === 0) throw new Error("need ≥1 participant");

  const n   = BigInt(participants.length);
  const base= amount / n;            // integer division
  const rem = Number(amount - base * n);   // 0 .. n-1

  // deterministic order so re-runs produce same shares
  const sorted = [...participants].sort();

  return sorted.map((uid, i) => ({
    user_id: uid,
    share:   base + (i < rem ? 1n : 0n),
    is_remainder_payer: i < rem,
  }));
}
```

**Why deterministic at expense-creation time, not at settlement time?**
If we re-derived shares at settlement, deleting/adding members later would make older expenses' shares change → ledger drift. Storing the split row freezes history.

### 8.2 Net balance per user per group per currency
Stored or computed via the `group_balances` view (§6.4). Formula:

```
net(user, group, ccy) =
   Σ (paid by user)     – paid for this user's group in this ccy
 – Σ (owed by user)     – sum of expense_splits.share where user participates
 + Σ (repaid by user)   – ACCEPTED repayments where user is debtor
 – Σ (received by user) – ACCEPTED repayments where user is creditor
```
Positive net ⇒ user is owed money. Negative ⇒ user owes.

### 8.3 Debt simplification (greedy max-creditor / max-debtor)
This is the variant Splitwise uses (per Mithun Mohan K's analysis and confirmed by Splitwise's own rules). Optimal "minimum number of transactions" is NP-hard (Optimal Account Balancing reduces to Sum-of-Subsets), so a greedy O(N² log N) algorithm is used in practice.

**Algorithm (per currency):**
```ts
function simplifyDebts(balances: Map<UUID, bigint>): Transfer[] {
  // balances: net per user (positive = creditor, negative = debtor)
  const transfers: Transfer[] = [];

  // copy into mutable arrays, drop zeros
  const debtors:   {id: UUID, amt: bigint}[] = [];
  const creditors: {id: UUID, amt: bigint}[] = [];
  for (const [id, bal] of balances) {
    if (bal > 0n) creditors.push({ id, amt: bal });
    else if (bal < 0n) debtors.push({ id, amt: -bal });
  }

  // sort descending by amount (max-heap behavior)
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => Number(b.amt - a.amt));
    creditors.sort((a, b) => Number(b.amt - a.amt));

    const d = debtors[0];
    const c = creditors[0];
    const x = d.amt < c.amt ? d.amt : c.amt;   // min

    transfers.push({ from: d.id, to: c.id, amount: x });
    d.amt -= x; c.amt -= x;

    if (d.amt === 0n) debtors.shift();
    if (c.amt === 0n) creditors.shift();
  }
  return transfers;
}
```

**Key properties:**
- Always produces a valid settlement (∑ debt = ∑ credit by construction).
- Transactions ≤ N − 1 (because each step zeroes at least one party).
- **Trade-off:** It does **not** preserve the rule "no one pays someone they didn't owe" — Splitwise's founder confirmed Splitwise also breaks this rule. Brosplit makes simplification optional via a per-group toggle (`simplify_debts BOOLEAN`, Phase 2).

### 8.4 Multi-currency handling

**Decision:** **Keep balances per currency, never auto-convert in MVP.** This matches Splitwise free tier behavior and avoids correctness disputes from fluctuating FX rates.

- Each `expense` has a `currency` column.
- Each `repayment` has a `currency` column and **must match an existing balance currency** (UI prevents mismatch).
- The `group_balances` view aggregates by `(group_id, currency, user_id)`.
- Debt simplification runs **independently per currency**.
- Profile shows totals as a list: "You are owed ₹2,400, $50, €30" — never collapsed unless a Phase-2 user-supplied FX rate is applied.

**Why not a single base currency?**
- Floating-point conversion + integer-only constraint = double rounding.
- FX rates change daily → recomputing historical expenses is misleading.
- Splitwise's Pro currency conversion is one-tap, irreversible, and uses a snapshot rate; Brosplit will replicate that approach in Phase 3 as an explicit "Lock conversion at rate X" action.

### 8.5 Combined edge case: integer-only + multi-currency + simplification
Worst-case scenario: travel group with 4 members, expenses in INR, USD, EUR, and ₹100 split 3 ways.

1. **Splitting:** Each expense uses §8.1 — ₹100 → 33/33/34. Stored with `is_remainder_payer` flag so re-edits preserve fairness.
2. **Balance accumulation:** The view sums per `(group, currency, user)` tuple — no cross-currency arithmetic.
3. **Simplification:** Run §8.3 three times (once per currency), produce three separate transfer lists.
4. **Repayment:** Debtor sees three lists; chooses to settle in INR only — creates only INR repayments. EUR and USD positions remain.

This keeps every step **deterministic, integer-exact, and currency-isolated**.

---

## 9. Tech Stack Recommendation

### 9.1 Final stack

| Layer | Choice | Version | Why over alternatives |
|---|---|---|---|
| Frontend framework | **Next.js (App Router)** | 15.x | Best Vercel integration, RSC for fast mobile loads, server actions reduce API-route boilerplate, excellent Supabase tooling. Vite is faster locally but lacks SSR + edge by default. SvelteKit is great but smaller ecosystem of fintech/UI components. Remix's value prop has narrowed since Next 15. |
| Language | **TypeScript** | 5.4+ | Mandatory for fintech-style correctness; Zod end-to-end. |
| Backend | **Next.js Route Handlers + Postgres RPC** | – | Free on Vercel; co-located with frontend; for heavier work use Supabase Edge Functions (Deno). Avoid separate Express server — extra hosting cost and ops. |
| Database | **Supabase Postgres** | PG 15 | Free tier (500 MB DB, 2 projects) covers MVP; gives RLS, Auth, Realtime, Storage in one. Neon is faster but requires separate Auth (Clerk/NextAuth). PlanetScale has dropped free tier. Railway has limited free credits. |
| Auth | **Supabase Auth** | – | Bundled, JWT-based, RLS-aware. NextAuth/Auth.js requires extra DB tables and work for RLS integration. Clerk's free tier (10k MAU) is generous but adds another vendor and pricing risk. |
| Realtime | **Supabase Realtime** | – | Free tier 200 concurrent connections; postgres_changes streams notifications and balance updates. Pusher free tier is also viable but adds another account. Custom WebSockets won't work on Vercel's stateless functions. |
| Hosting | **Vercel (Hobby)** | – | Best Next.js DX; free CDN; preview deployments. Cloudflare Pages is faster on edge but Next.js App Router on CF still has edge cases. Netlify is fine but Next.js 15 features sometimes lag. |
| State (server) | **TanStack Query** | 5.x | The de-facto standard for server state in React; cache, optimistic updates, background refetch. |
| State (client) | **Zustand** | 4.x | Tiny (~1 KB), no Provider wrapping needed; perfect for UI state (modals, multi-step expense form). Redux Toolkit is overkill here. |
| UI library | **Tailwind CSS + shadcn/ui** | TW 4, latest shadcn | Copy-paste components → no runtime dep; full Tailwind control; Radix primitives for accessibility. Mantine and Chakra are component libraries with bigger runtime cost; harder to fit a custom mobile-first design. |
| Forms | **React Hook Form + Zod** | RHF 7, Zod 3 | Best mobile perf (uncontrolled inputs); shared Zod schemas server↔client. |
| PWA | **next-pwa** or **@serwist/next** | latest | Service-worker + manifest; installable on iOS/Android. |
| Icons | **lucide-react** | latest | Tree-shakeable; default in shadcn. |
| Analytics (opt) | **Vercel Web Analytics** | – | Free, privacy-friendly. |
| Error tracking | **Sentry free tier** | – | 5k errors/mo. |
| Validation | **Zod** | 3.x | Single source of truth for shapes. |
| Testing | **Vitest + Testing Library + Playwright** | – | Fast, modern, parallel. |
| CI/CD | **GitHub Actions + Vercel auto-deploy** | – | Free for public repos / generous for private. |

### 9.2 Stack comparison summary

**Frontend choice rationale:**
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Next.js 15 | RSC, server actions, Vercel-native, huge community | Largest bundle baseline | **Chosen** |
| React + Vite | Fastest dev | Manual SSR/edge; less DX for App Router patterns | Reject |
| SvelteKit | Smallest bundle, excellent DX | Smaller ecosystem; fewer fintech examples | Reject |
| Remix | Great data loaders | Acquired by Shopify; momentum unclear | Reject |

**DB choice rationale:**
| Option | Free tier | Auth | Realtime | RLS | Verdict |
|---|---|---|---|---|---|
| Supabase | 500 MB, 2 proj | ✅ built-in | ✅ | ✅ Postgres-native | **Chosen** |
| Neon | 0.5 GB | ❌ external | ❌ | ✅ (manual) | reject |
| PlanetScale | (paid) | ❌ | ❌ | – | reject |
| Railway | $5 credits/mo | ❌ | ❌ | – | reject |

---

## 10. UI/UX Design Guidelines

### 10.1 Mobile-first principles
- Design at **360 px width first**, scale up.
- Bottom navigation bar (thumb zone): Home / Groups / Add (+) / Notifications / Profile.
- Floating + button is the primary "add expense" action on group screens.
- All interactive elements ≥44×44 px (Apple HIG) tap target.
- Use system sheets/drawers (Radix `Drawer` from Vaul) instead of full-page modals on mobile.
- Avoid hover-only states. Use long-press or explicit menu icons.
- Form inputs use `inputmode="numeric"` for amount (mobile keyboard).
- Skeleton loaders, never blocking spinners.

### 10.2 Color scheme (Tailwind tokens)
- **Primary (brand):** `#10b981` (emerald-500) — money, positive lent.
- **Accent:** `#6366f1` (indigo-500) — actions, links.
- **Danger / owed:** `#ef4444` (red-500).
- **Neutral surface:** zinc-50 / zinc-900.
- Dark mode via `media` strategy + manual toggle (Phase 2).
- **Contrast minimum 4.5:1** for all text on background.

### 10.3 Typography
- System font stack via Tailwind: `font-sans` (Inter via `next/font`).
- Sizes: 12 / 14 / 16 / 20 / 24 / 30. Body 14–16 px on mobile.
- Tabular numbers for all amounts: `font-feature-settings: 'tnum'`.

### 10.4 Key screens

**Home / Groups list**
```
┌─────────────────────────────┐
│  Brosplit          [Bell⁵] │
├─────────────────────────────┤
│  Total owed:   ₹1,200       │
│  Total lent:   ₹2,400  $50  │
├─────────────────────────────┤
│  YOUR GROUPS                │
│  ┌─────────────────────┐    │
│  │  🍕 Goa Trip        │    │
│  │  4 members · ₹2,400 │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │  🏠 Apartment 4B    │    │
│  └─────────────────────┘    │
│           [+ New Group]     │
└─────────────────────────────┘
[Home][Groups][+][Bell][Profile]
```

**Group detail**
- Header: name, member avatars, settings icon.
- Three tabs: **Balances · Expenses · History**.
- Floating + → Add Expense.
- Balances tab shows simplified-debt cards: "You owe Anita ₹450" with **Settle** CTA.

**Add expense (2-step)**
- Step 1: big amount input, currency chip (tap to change), name field, "Paid by" selector defaulting to current user, **Next**.
- Step 2: member checklist, all checked; tap row to toggle; per-row preview share. **Split** button.

**Settle Up sheet**
- Lists all current owed positions (one per creditor, per currency).
- Each row: checkbox, amount input prefilled with full owed amount, description.
- Bottom **Send Request(s)** button.

**Profile**
- Avatar, name, email.
- "You are owed" card: per-currency totals; tap → drill list.
- "You owe" card: same.
- Logout button.

**Notifications**
- Reverse-chronological list.
- Unread items have left accent bar.
- Tap → contextual page (group, expense, repayment).
- Pull-to-refresh.

### 10.5 Accessibility checklist
- Label every form input (`<label>` or `aria-label`).
- Focus ring visible (`focus-visible:ring-2`).
- ESC closes drawers/modals.
- Notification icon has `aria-label="Notifications, 5 unread"`.
- Currency amounts read out as "two thousand four hundred rupees" via `aria-label` on number elements.

---

## 11. Security Implementation

### 11.1 Checklist
| Area | Control |
|---|---|
| **Password hashing** | Handled by Supabase Auth (bcrypt internally). For new self-implemented systems Argon2id is the OWASP 2025 recommendation; **Brosplit uses Supabase Auth, so we inherit bcrypt** which remains secure when configured by Supabase. We do not roll our own. |
| **Auth tokens** | Supabase issues short-lived JWT (1 h) + refresh token; stored as **HTTP-only, Secure, SameSite=Lax cookies** via `@supabase/ssr`. Never in localStorage. |
| **CSRF** | SameSite=Lax cookie + Origin header check on mutating Route Handlers; double-submit token if any cross-site form. |
| **Rate limiting** | Upstash Redis (free 10k cmd/day) middleware on `/api/auth/*` (5 / 15 min / IP) and `/api/repayments/*` (30 / min / user). |
| **SQL injection** | Eliminated via Supabase JS parameterized queries and parameterized RPCs; never string-concatenate SQL. |
| **Authorization** | Postgres **RLS** policies (§6.5) are the source of truth. App-layer checks are defense-in-depth, not primary. |
| **Input validation** | Zod schemas on every Server Action / Route Handler input. Reject extra fields. |
| **Output encoding** | React auto-escapes JSX; never `dangerouslySetInnerHTML` for user content. |
| **HTTPS / HSTS** | Vercel auto-provisions TLS; add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`. |
| **Security headers** | Configure in `next.config.ts`: CSP (script-src self + Vercel, connect-src Supabase URL), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. |
| **Sensitive logging** | Never log emails, tokens, or amounts in plain text in app logs. |
| **Secrets** | Vercel env vars (`SUPABASE_SERVICE_ROLE_KEY` server-only); never expose service-role key to client. |
| **Invite-link tokens** | 32-byte URL-safe random; compared with constant-time function in RPC; expire after 7 days; single-use option. |
| **Dependency audit** | `npm audit` + Dependabot weekly. |
| **Account enumeration** | Login failures return generic "Invalid credentials"; signup duplicate-email returns same generic message + sends a notification email "an account already exists". |

### 11.2 CSP header example
```
default-src 'self';
script-src  'self' 'unsafe-inline' https://va.vercel-scripts.com;
style-src   'self' 'unsafe-inline';
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
img-src     'self' data: https:;
frame-ancestors 'none';
```

### 11.3 Threat-model highlights
- **Stolen invite link** → mitigated via expiry + admin can revoke.
- **Replay of repayment request** → idempotency key on insert.
- **Privilege escalation** (user editing other's balance) → blocked by RLS even if API is compromised.
- **Removed member retains read access** → RLS uses `removed_at IS NULL` predicate; instant cutoff.

---

## 12. Notification System Architecture

### 12.1 Storage
- All notifications in `notifications` table (§6.2).
- Payload is JSONB → flexible without migrations.

### 12.2 Generation
- **Database triggers** for high-fidelity events (insert into `expenses` → fan-out notifications to all participants).
```sql
CREATE OR REPLACE FUNCTION notify_expense_added() RETURNS trigger AS $$
BEGIN
    INSERT INTO notifications (user_id, type, payload)
    SELECT s.user_id, 'EXPENSE_ADDED',
           jsonb_build_object(
             'group_id', NEW.group_id,
             'expense_id', NEW.id,
             'name', NEW.name,
             'amount', NEW.amount,
             'currency', NEW.currency,
             'actor_id', NEW.created_by)
    FROM expense_splits s
    WHERE s.expense_id = NEW.id AND s.user_id <> NEW.created_by;
    RETURN NEW;
END;$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_expense_added AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION notify_expense_added();
```

### 12.3 Delivery
- Initial fetch: server component reads last 50 notifications.
- Live updates: Supabase Realtime channel `notifications:user:{uid}` filters `user_id = uid` via RLS.

### 12.4 Mark as read
- Single: `UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=auth.uid()`.
- Bulk: `UPDATE notifications SET read_at=now() WHERE user_id=auth.uid() AND read_at IS NULL`.

### 12.5 Badge count
- Header bell shows `count(*) FILTER (WHERE read_at IS NULL)` from a cached query (TanStack Query, 30 s stale time, invalidated on Realtime event).

---

## 13. Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| Removing a member with pending balance | Backend RPC `remove_member(group, user, confirm)`. First call returns balance summary `{ owes: {INR: 450}, owed: {INR: 120} }`. UI shows warning modal. Second call with `confirm=true` deletes splits + voids pending repayments + removes member. Wrapped in transaction. |
| Group with only one member left | Auto-archive group; admin sees "you're alone here — delete?" prompt. Cannot add expenses. |
| Removing the last admin | Forbidden. Admin must promote another member first (Phase 2). |
| Repayment rejected | Original balance unchanged; debtor notified; debtor can re-request. |
| Repayment for amount > current owed | Allowed (acts as pre-payment / credit) but UI shows warning. Net balance can flip sign. |
| Currency mismatch in repayment | UI restricts repayment currency to currencies present in current balance with that creditor. |
| Expired invite link | `/join/{token}` shows "This invite has expired. Ask the admin for a new one." |
| Network failure mid-split | Idempotency key on `create_expense` RPC; client retries safely. Optimistic UI update rolled back on error. |
| Concurrent edits to same expense | `updated_at` optimistic-lock check in RPC. Conflict → 409 + "expense changed, refresh". |
| User deletes account | Cascade: their `users` row → cascades delete on group_members; expenses they paid keep `paid_by` historical reference but anonymized as "Removed user". (Hard delete is GDPR-compliant; soft delete optional.) |
| Splitting ₹1 among 3 people | base=0, remainder=1 → shares [1, 0, 0]. Allowed. UI warns "Some participants will owe nothing on this expense." |
| Splitting ₹0 | Rejected at validation: amount must be > 0. |
| Negative amount or non-integer | Zod rejects at form; CHECK constraint at DB rejects. |
| Group deleted while user is on group page | Realtime subscription receives DELETE → toast "Group was deleted" → redirect home. |
| User offline | PWA shell + cached last-fetched data shown read-only. "Add expense" button disabled with "You're offline" tooltip. Queue mutations in IndexedDB (Phase 2). |
| Multiple currencies in group | Balances list shows one row per currency. Settle Up groups by currency. |
| User changes email | Email is the unique ID; we allow change via Supabase auth flow and update `users.email`. Existing references unaffected (FK on UUID). |
| Same user added twice via duplicate invite | PRIMARY KEY (group_id, user_id) prevents duplicate; backend returns "already a member". |

---

## 14. Implementation Plan / Phased Roadmap

### Phase 0 — Foundations (Week 1)
- Repo init, Next.js 15 + TS + Tailwind + shadcn.
- Supabase project, env wiring.
- Auth pages (signup/login/logout) using Supabase Auth.
- Base layout, mobile bottom nav, theme tokens.
- CI: GitHub Actions running typecheck + lint + Vitest.
- **Deliverable:** logged-in empty home screen on Vercel preview URL.

### Phase 1 — MVP Core (Weeks 2–4)

**Week 2 — Groups**
- DB migrations: users, groups, group_members, invite_links + RLS.
- Create / list / delete group flows.
- Invite link generation + join flow.
- Member list view; admin can remove member (no balance check yet).

**Week 3 — Expenses**
- DB migrations: expenses, expense_splits, RPC `create_expense`.
- Add Expense 2-step form.
- Splitting algorithm (§8.1) implemented + unit tests.
- Group expenses tab.
- `group_balances` view.

**Week 4 — Repayments + Notifications**
- DB migrations: repayments, notifications + triggers.
- Settle Up sheet, request → accept → reject flow.
- Notification feed page + badge.
- Remove-member with balance-warning modal.
- Profile page with per-currency totals.
- **Deliverable:** end-to-end usable MVP.

### Phase 2 — Polish & Differentiators (Weeks 5–6)
- Debt simplification toggle per group (§8.3).
- Multi-currency UI improvements.
- Realtime notifications (Supabase channels).
- PWA manifest + service worker (offline shell).
- Empty states, loading skeletons, error boundaries.
- Password reset (magic link).
- Dark mode.
- E2E test suite (Playwright) for critical flows.

### Phase 3 — Beta Hardening (Weeks 7–8)
- Sentry integration.
- Upstash rate limiting.
- Security headers + CSP.
- Accessibility audit (axe-core in CI).
- Mobile device QA (iOS Safari, Chrome Android).
- Beta launch with 20–50 users.
- Iterate on feedback.

### Phase 4 — Future (post-MVP)
See §18.

---

## 15. Project Folder Structure

```
brosplit/
├── .github/workflows/         # CI: typecheck, lint, test, deploy
├── public/
│   ├── icons/                 # PWA icons 192, 512, maskable
│   └── manifest.webmanifest
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # public auth routes
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (app)/             # authenticated routes (layout enforces session)
│   │   │   ├── layout.tsx     # bottom nav, top header
│   │   │   ├── page.tsx       # home (groups list + totals)
│   │   │   ├── groups/
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx              # group detail
│   │   │   │       ├── expenses/new/page.tsx
│   │   │   │       ├── settle/page.tsx
│   │   │   │       └── settings/page.tsx
│   │   │   ├── join/[token]/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── api/               # Route Handlers (used sparingly)
│   │   │   ├── webhooks/
│   │   │   └── auth/...
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                # shadcn primitives (button, sheet, dialog, ...)
│   │   ├── groups/
│   │   ├── expenses/
│   │   ├── repayments/
│   │   └── shared/            # BottomNav, Header, EmptyState
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # browser client
│   │   │   ├── server.ts      # RSC / route-handler client
│   │   │   └── middleware.ts  # session refresh
│   │   ├── algos/
│   │   │   ├── splitEqual.ts
│   │   │   ├── netBalance.ts
│   │   │   └── simplifyDebts.ts
│   │   ├── validators/        # Zod schemas (shared client+server)
│   │   ├── currency.ts
│   │   └── utils.ts           # cn(), formatAmount(), ...
│   ├── hooks/                 # useGroups, useExpenses, useNotifications
│   ├── stores/                # Zustand (UI state only)
│   ├── types/                 # generated DB types from Supabase
│   └── middleware.ts          # auth gate
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_rls.sql
│   │   ├── 0003_rpc.sql
│   │   └── 0004_triggers.sql
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/                  # Vitest
│   └── e2e/                   # Playwright
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 16. Testing Strategy

| Level | Tool | Coverage |
|---|---|---|
| Unit | **Vitest + Testing Library** | All `lib/algos/*` (splitEqual, simplifyDebts, netBalance), Zod schemas, utility functions. **100% coverage on algorithms.** |
| Integration | **Vitest + Supabase local (CLI)** | RPCs (`create_expense`, `remove_member`, `accept_repayment`); RLS policies (positive + negative tests per table). |
| E2E | **Playwright** | Critical flows: signup → create group → invite → add expense → settle → accept → check profile totals. Run on Chromium + Webkit (mobile viewport). |
| Visual regression | **Playwright screenshots** | Key screens at 360, 414, 768. |
| Accessibility | **axe-playwright** | WCAG AA on every E2E pass. |
| Performance | **Lighthouse CI** | Mobile score ≥85 on home, group, profile. |
| Security | **`npm audit` + Dependabot + Snyk free tier** | Weekly. |

### Algorithm test cases (must include)
```ts
// splitEqual
expect(splitEqual(100n, [a,b,c])).toEqual([{a,33,T},{b,33,F},{c,34,F}].sortedBy(id));
expect(splitEqual(1n,   [a,b,c])).toEqual( shares with sum 1 );
expect(splitEqual(7n,   [a,b])  ).toEqual( shares with sum 7 );
// simplifyDebts
expect(simplify({a:+20,b:-20})).toEqual([{from:b,to:a,amount:20}]);
expect(simplify({a:0,b:0,c:0})).toEqual([]);
// edge: chain a→b→c collapses to a→c
expect(simplify({a:-20,b:0,c:+20})).toEqual([{from:a,to:c,amount:20}]);
```

---

## 17. Deployment & DevOps

### 17.1 Environments
| Env | Purpose | Hosting |
|---|---|---|
| Local | dev | `pnpm dev` + Supabase CLI |
| Preview | PR review | Vercel auto-deploy per PR + ephemeral Supabase branch |
| Production | live | Vercel main branch + Supabase main project |

### 17.2 Environment variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # server only, never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=https://brosplit.app
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SENTRY_DSN=...                              # optional
```

### 17.3 CI/CD pipeline (GitHub Actions)
```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm test:e2e --project=chromium-mobile
```
Vercel handles deploy on merge to `main`.

### 17.4 Database migrations
- Supabase CLI: `supabase migration new <name>` → SQL in `supabase/migrations/`.
- Apply on Production via `supabase db push --linked`.
- Rollback strategy: every migration must have a paired comment with reversible SQL where feasible.

### 17.5 Monitoring
- Vercel Analytics for traffic.
- Sentry for client + server errors.
- Supabase dashboard for DB query stats; alert on slow queries.

---

## 18. Future Enhancements

| Feature | Notes |
|---|---|
| **Receipt OCR** | Upload photo → use Tesseract.js on-device or OpenAI GPT-4o-mini server-side to autofill amount and merchant. |
| **Recurring expenses** | `pg_cron` Supabase extension; "Rent ₹15,000 / month, splits 1st of every month". |
| **Categories + analytics** | Predefined categories (Food, Transport, ...); donut/bar charts via Recharts; per-month totals. |
| **Dark mode** | CSS variables already in shadcn; add toggle. |
| **Export CSV / PDF** | Server-side render with `@react-pdf/renderer`. |
| **Push notifications** | Web Push API + service worker; opt-in. |
| **Currency conversion** | Optional, user-supplied snapshot rate; "lock rate" action. |
| **Friends (1-1 outside group)** | Direct expenses without a group, like Splitwise. |
| **Splits other than equal** | By percent, by share, by exact amount. |
| **Integrations** | UPI deep links (India), PayPal.me / Venmo (US) on Settle Up. |
| **Shared shopping lists** | Inside groups. |
| **Multilingual** | i18n via `next-intl`. |
| **Native app wrapper** | Capacitor wrapping the same PWA for App Store presence. |
| **Splitwise import** | CSV importer for migration. |

---

## 19. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase free-tier limits hit (500 MB / 2 GB egress / 200 RT connections) | Med | High | Monitor usage; archive old expenses; introduce paid tier ($25/mo Pro) before launch growth phase. |
| Vercel function execution > 10 s (Hobby limit) | Low | Med | Move heavy ops (debt simplification on huge groups) to Postgres functions or background queue. |
| Algorithm bugs in money math | Low | **Very high** | 100% unit test coverage on `splitEqual`, `netBalance`, `simplifyDebts`; integer-only math eliminates float errors; CI gates on coverage. |
| RLS misconfiguration leaking data | Med | **Very high** | Comprehensive RLS test suite (positive + negative per role per table); peer review of every policy migration. |
| User trust — "is the math right?" | Med | High | Show full breakdown on every screen; "Why this amount?" tooltip; export CSV (Phase 2). |
| Email/account abuse (spam signups) | Med | Med | Rate limit signup endpoint; require email confirmation in Supabase Auth; add hCaptcha (Phase 2). |
| Lost / leaked invite link | Med | Med | 7-day expiry; admin can revoke; one-time-use option. |
| Group admin departure | Low | Med | Phase 2: admin can transfer ownership; auto-promote oldest member if admin removed. |
| Currency confusion (mixed currencies in same group) | High | Med | Always render currency code/symbol next to amount; tabular per-currency lists; never collapse without explicit conversion. |
| Vendor lock-in (Supabase) | Low | Low | Postgres is portable; Supabase Auth replaceable with NextAuth + Postgres if needed. |

---

## 20. Glossary

| Term | Definition |
|---|---|
| **Admin** | The user who created a group; can remove members, generate invites, delete the group. |
| **Balance** | Net amount per (user, group, currency). Positive = owed to user; negative = user owes. |
| **Brosplit** | The product. |
| **CITEXT** | PostgreSQL case-insensitive text type, used for emails. |
| **Debt simplification** | Reducing the number of pairwise transfers needed to settle all balances. |
| **Expense** | A bill paid by one user that should be shared by some/all members. |
| **Expense split** | A row defining one participant's share of a single expense. |
| **Idempotency key** | Client-generated UUID sent with mutating requests to prevent duplicates on retry. |
| **Integer-only amount** | Amounts stored as `BIGINT` whole units (rupees, cents) — no decimals. |
| **JWT** | JSON Web Token issued by Supabase Auth; carries user identity to RLS via `auth.uid()`. |
| **PWA** | Progressive Web App — installable web app with service worker. |
| **Repayment** | A debtor-initiated request to settle some balance with a creditor; requires creditor acceptance. |
| **RLS** | Row-Level Security — Postgres-native row filtering enforced regardless of how the DB is accessed. |
| **RPC** | Remote Procedure Call — a Postgres function exposed via Supabase REST. |
| **Service role key** | Privileged Supabase key that bypasses RLS; server-only. |
| **Settle up** | The act of one or more repayments closing out a debt. |
| **Simplification toggle** | Per-group setting that, when on, shows simplified debt suggestions (Phase 2). |
| **Zod** | TypeScript-first schema validation library used end-to-end. |

---

**End of document.**

This PRD is engineered to be directly actionable: a developer can begin Week 1 of the Implementation Plan immediately, the SQL migrations can be pasted into Supabase, the algorithms are specified with sufficient precision to unit-test against, and the security policies provide both row-level enforcement and defense in depth.