-- Brosplit core schema
-- Integer-only money amounts (BIGINT). One row per signed-up user mirroring auth.users.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

------------------------------------------------------------
-- USERS
------------------------------------------------------------
CREATE TABLE public.users (
    id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email            CITEXT UNIQUE NOT NULL,
    full_name        TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80),
    avatar_url       TEXT,
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON public.users (email);

------------------------------------------------------------
-- GROUPS
------------------------------------------------------------
CREATE TABLE public.groups (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    primary_currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_by       UUID NOT NULL REFERENCES public.users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_groups_created_by ON public.groups (created_by);

------------------------------------------------------------
-- GROUP_MEMBERS
------------------------------------------------------------
CREATE TYPE group_role AS ENUM ('admin', 'member');

CREATE TABLE public.group_members (
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role       group_role NOT NULL DEFAULT 'member',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at TIMESTAMPTZ,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON public.group_members (user_id) WHERE removed_at IS NULL;

------------------------------------------------------------
-- INVITE_LINKS
------------------------------------------------------------
CREATE TABLE public.invite_links (
    token      TEXT PRIMARY KEY,
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invite_group ON public.invite_links (group_id);

------------------------------------------------------------
-- EXPENSES
------------------------------------------------------------
CREATE TABLE public.expenses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    amount     BIGINT NOT NULL CHECK (amount > 0),
    currency   CHAR(3) NOT NULL,
    paid_by    UUID NOT NULL REFERENCES public.users(id),
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_expenses_group ON public.expenses (group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_paid_by ON public.expenses (paid_by);

------------------------------------------------------------
-- EXPENSE_SPLITS
------------------------------------------------------------
CREATE TABLE public.expense_splits (
    expense_id         UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES public.users(id),
    share              BIGINT NOT NULL CHECK (share >= 0),
    is_remainder_payer BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (expense_id, user_id)
);

------------------------------------------------------------
-- REPAYMENTS
------------------------------------------------------------
CREATE TYPE repayment_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE public.repayments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    debtor_id       UUID NOT NULL REFERENCES public.users(id),
    creditor_id     UUID NOT NULL REFERENCES public.users(id),
    amount          BIGINT NOT NULL CHECK (amount > 0),
    currency        CHAR(3) NOT NULL,
    description     TEXT,
    status          repayment_status NOT NULL DEFAULT 'PENDING',
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at      TIMESTAMPTZ,
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
    'GROUP_INVITE', 'GROUP_JOINED', 'GROUP_REMOVED',
    'MEMBER_JOINED', 'MEMBER_REMOVED',
    'EXPENSE_ADDED', 'EXPENSE_EDITED', 'EXPENSE_DELETED',
    'REPAYMENT_REQUEST', 'REPAYMENT_ACCEPTED', 'REPAYMENT_REJECTED'
);

CREATE TABLE public.notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    payload    JSONB NOT NULL,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread
    ON public.notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

------------------------------------------------------------
-- AUTH BRIDGE: auto-create profile on signup
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

------------------------------------------------------------
-- BALANCE VIEW
-- Per (group, currency, user) net balance. Positive = owed to user.
------------------------------------------------------------
CREATE OR REPLACE VIEW public.group_balances AS
WITH paid AS (
    SELECT e.group_id, e.currency, e.paid_by AS user_id, SUM(e.amount) AS total
    FROM public.expenses e WHERE e.deleted_at IS NULL GROUP BY 1, 2, 3
),
owed AS (
    SELECT e.group_id, e.currency, s.user_id, SUM(s.share) AS total
    FROM public.expenses e
    JOIN public.expense_splits s ON s.expense_id = e.id
    WHERE e.deleted_at IS NULL GROUP BY 1, 2, 3
),
repaid AS (
    SELECT group_id, currency, debtor_id AS user_id, SUM(amount) AS total
    FROM public.repayments WHERE status = 'ACCEPTED' GROUP BY 1, 2, 3
),
received AS (
    SELECT group_id, currency, creditor_id AS user_id, SUM(amount) AS total
    FROM public.repayments WHERE status = 'ACCEPTED' GROUP BY 1, 2, 3
)
SELECT
    COALESCE(p.group_id, o.group_id, r.group_id, rc.group_id) AS group_id,
    COALESCE(p.currency, o.currency, r.currency, rc.currency) AS currency,
    COALESCE(p.user_id, o.user_id, r.user_id, rc.user_id)     AS user_id,
    COALESCE(p.total, 0)
        - COALESCE(o.total, 0)
        + COALESCE(r.total, 0)
        - COALESCE(rc.total, 0) AS net_balance
FROM paid p
FULL OUTER JOIN owed     o  USING (group_id, currency, user_id)
FULL OUTER JOIN repaid   r  USING (group_id, currency, user_id)
FULL OUTER JOIN received rc USING (group_id, currency, user_id);
