-- 0006: expense idempotency, refreshed create_expense RPC, and user-open-positions
-- RPC for the profile drill-down. Idempotent on re-run.

------------------------------------------------------------
-- EXPENSES: idempotency_key (UUID, unique when set)
------------------------------------------------------------
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ux_expenses_idempotency_key
    ON public.expenses (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

------------------------------------------------------------
-- create_expense: accept an optional idempotency key. If a row with that key
-- already exists, return its id without inserting again.
------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_expense(UUID, TEXT, BIGINT, CHAR(3), UUID, UUID[]);

CREATE OR REPLACE FUNCTION public.create_expense(
    p_group_id        UUID,
    p_name            TEXT,
    p_amount          BIGINT,
    p_currency        CHAR(3),
    p_paid_by         UUID,
    p_participants    UUID[],
    p_idempotency_key UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_expense_id UUID;
    v_n          INT;
    v_base       BIGINT;
    v_remainder  INT;
    v_uid        UUID;
    v_idx        INT := 0;
    v_sorted     UUID[];
BEGIN
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a group member';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'amount must be a positive integer';
    END IF;

    v_n := COALESCE(array_length(p_participants, 1), 0);
    IF v_n < 1 THEN
        RAISE EXCEPTION 'at least one participant required';
    END IF;

    -- Idempotency short-circuit.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_expense_id
        FROM public.expenses
        WHERE idempotency_key = p_idempotency_key;
        IF v_expense_id IS NOT NULL THEN
            RETURN v_expense_id;
        END IF;
    END IF;

    -- Verify every participant is a current member of the group.
    IF EXISTS (
        SELECT 1 FROM unnest(p_participants) AS pid
        WHERE NOT EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = p_group_id AND gm.user_id = pid AND gm.removed_at IS NULL
        )
    ) THEN
        RAISE EXCEPTION 'all participants must be current group members';
    END IF;

    -- Verify paid_by is also a current member.
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id AND gm.user_id = p_paid_by AND gm.removed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'paid_by must be a current group member';
    END IF;

    v_base      := p_amount / v_n;
    v_remainder := (p_amount - v_base * v_n)::INT;

    SELECT array_agg(p ORDER BY p) INTO v_sorted FROM unnest(p_participants) p;

    INSERT INTO public.expenses (
        group_id, name, amount, currency, paid_by, created_by, idempotency_key
    )
    VALUES (
        p_group_id, p_name, p_amount, p_currency, p_paid_by, auth.uid(), p_idempotency_key
    )
    RETURNING id INTO v_expense_id;

    FOREACH v_uid IN ARRAY v_sorted LOOP
        INSERT INTO public.expense_splits (expense_id, user_id, share, is_remainder_payer)
        VALUES (
            v_expense_id,
            v_uid,
            v_base + CASE WHEN v_idx < v_remainder THEN 1 ELSE 0 END,
            v_idx < v_remainder
        );
        v_idx := v_idx + 1;
    END LOOP;

    RETURN v_expense_id;
END;
$$;

------------------------------------------------------------
-- delete_expense: soft-delete; only the creator or a group admin may do this.
-- Uses SECURITY INVOKER so RLS still applies as a backstop.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_expense(p_expense_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_e public.expenses;
BEGIN
    SELECT * INTO v_e FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
    IF v_e.id IS NULL THEN
        RAISE EXCEPTION 'expense not found';
    END IF;
    IF v_e.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'expense already deleted';
    END IF;
    IF v_e.created_by <> auth.uid() AND NOT public.is_group_admin(v_e.group_id) THEN
        RAISE EXCEPTION 'only the creator or group admin can delete this expense';
    END IF;

    UPDATE public.expenses SET deleted_at = now() WHERE id = p_expense_id;
END;
$$;

------------------------------------------------------------
-- leave_group: a member removes themselves. Admins cannot leave unless
-- another admin remains. The notification fans out to remaining admins.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_uid       UUID := auth.uid();
    v_my_role   group_role;
    v_remaining INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'must be authenticated';
    END IF;

    SELECT role INTO v_my_role
    FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_uid AND removed_at IS NULL;

    IF v_my_role IS NULL THEN
        RAISE EXCEPTION 'not a member of this group';
    END IF;

    IF v_my_role = 'admin' THEN
        SELECT COUNT(*) INTO v_remaining
        FROM public.group_members
        WHERE group_id = p_group_id
          AND role = 'admin'
          AND user_id <> v_uid
          AND removed_at IS NULL;
        IF v_remaining = 0 THEN
            RAISE EXCEPTION 'transfer admin or delete the group before leaving';
        END IF;
    END IF;

    UPDATE public.group_members
    SET removed_at = now()
    WHERE group_id = p_group_id AND user_id = v_uid AND removed_at IS NULL;

    -- Cancel pending repayments involving this user in this group.
    UPDATE public.repayments
    SET status = 'CANCELLED'
    WHERE group_id = p_group_id
      AND status = 'PENDING'
      AND (debtor_id = v_uid OR creditor_id = v_uid);

    -- Notify remaining admins.
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT gm.user_id, 'MEMBER_REMOVED',
           jsonb_build_object('group_id', p_group_id, 'actor_id', v_uid)
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.role = 'admin'
      AND gm.user_id <> v_uid
      AND gm.removed_at IS NULL;
END;
$$;

------------------------------------------------------------
-- get_user_open_positions: for the calling user, compute simplified open
-- transfers (per group, per currency) involving them. Greedy max-creditor /
-- max-debtor matching the client lib/algos/simplifyDebts behaviour.
--
-- Returns one row per open transfer where the caller is either debtor or
-- creditor. Counterparty is the other side. Powers the /profile drill-down
-- without round-tripping all group_balances rows to the client.
--
-- Column aliases (gid/gname/ccy) avoid PL/pgSQL ambiguity with RETURNS TABLE
-- output columns of the same name.
------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_open_positions();

CREATE OR REPLACE FUNCTION public.get_user_open_positions()
RETURNS TABLE (
    group_id     UUID,
    group_name   TEXT,
    currency     CHAR(3),
    role         TEXT,         -- 'lent' if caller is owed, 'owed' if caller owes
    counterparty UUID,
    counter_name TEXT,
    amount       BIGINT
)
LANGUAGE plpgsql SECURITY INVOKER STABLE SET search_path = public AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_g     RECORD;
    v_c     RECORD;
    v_d_id  UUID;
    v_d_amt BIGINT;
    v_c_id  UUID;
    v_c_amt BIGINT;
    v_x     BIGINT;
    debtors   UUID[];
    debt_amts BIGINT[];
    creds     UUID[];
    cred_amts BIGINT[];
BEGIN
    IF v_uid IS NULL THEN
        RETURN;
    END IF;

    FOR v_g IN
        SELECT gm.group_id AS gid, g.name AS gname
        FROM public.group_members gm
        JOIN public.groups g ON g.id = gm.group_id
        WHERE gm.user_id = v_uid AND gm.removed_at IS NULL AND g.deleted_at IS NULL
    LOOP
        FOR v_c IN
            SELECT DISTINCT gb.currency AS ccy
            FROM public.group_balances gb
            WHERE gb.group_id = v_g.gid
        LOOP
            debtors   := ARRAY[]::UUID[];
            debt_amts := ARRAY[]::BIGINT[];
            creds     := ARRAY[]::UUID[];
            cred_amts := ARRAY[]::BIGINT[];

            FOR v_d_id, v_d_amt IN
                SELECT gb.user_id, gb.net_balance
                FROM public.group_balances gb
                WHERE gb.group_id = v_g.gid AND gb.currency = v_c.ccy AND gb.net_balance < 0
                ORDER BY gb.net_balance ASC
            LOOP
                debtors   := debtors   || v_d_id;
                debt_amts := debt_amts || (-v_d_amt);
            END LOOP;

            FOR v_c_id, v_c_amt IN
                SELECT gb.user_id, gb.net_balance
                FROM public.group_balances gb
                WHERE gb.group_id = v_g.gid AND gb.currency = v_c.ccy AND gb.net_balance > 0
                ORDER BY gb.net_balance DESC
            LOOP
                creds     := creds     || v_c_id;
                cred_amts := cred_amts || v_c_amt;
            END LOOP;

            DECLARE
                di INT := 1;
                ci INT := 1;
            BEGIN
                WHILE di <= COALESCE(array_length(debtors, 1), 0)
                  AND ci <= COALESCE(array_length(creds, 1), 0) LOOP
                    v_x := LEAST(debt_amts[di], cred_amts[ci]);

                    IF debtors[di] = v_uid THEN
                        group_id     := v_g.gid;
                        group_name   := v_g.gname;
                        currency     := v_c.ccy;
                        role         := 'owed';
                        counterparty := creds[ci];
                        SELECT u.full_name INTO counter_name FROM public.users u WHERE u.id = creds[ci];
                        amount       := v_x;
                        RETURN NEXT;
                    ELSIF creds[ci] = v_uid THEN
                        group_id     := v_g.gid;
                        group_name   := v_g.gname;
                        currency     := v_c.ccy;
                        role         := 'lent';
                        counterparty := debtors[di];
                        SELECT u.full_name INTO counter_name FROM public.users u WHERE u.id = debtors[di];
                        amount       := v_x;
                        RETURN NEXT;
                    END IF;

                    debt_amts[di] := debt_amts[di] - v_x;
                    cred_amts[ci] := cred_amts[ci] - v_x;
                    IF debt_amts[di] = 0 THEN di := di + 1; END IF;
                    IF cred_amts[ci] = 0 THEN ci := ci + 1; END IF;
                END LOOP;
            END;
        END LOOP;
    END LOOP;
END;
$$;
