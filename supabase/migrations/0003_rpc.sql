-- Server-side RPCs for atomic multi-row operations.

------------------------------------------------------------
-- create_expense: insert expense + splits atomically with deterministic remainder.
-- Remainder participants are picked in ascending UUID order (matches client lib/algos/splitEqual).
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_expense(
    p_group_id     UUID,
    p_name         TEXT,
    p_amount       BIGINT,
    p_currency     CHAR(3),
    p_paid_by      UUID,
    p_participants UUID[]
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

    -- Deterministic order: sort participants by UUID ascending.
    SELECT array_agg(p ORDER BY p) INTO v_sorted FROM unnest(p_participants) p;

    INSERT INTO public.expenses (group_id, name, amount, currency, paid_by, created_by)
    VALUES (p_group_id, p_name, p_amount, p_currency, p_paid_by, auth.uid())
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
-- consume_invite: redeem an invite token to join a group.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_invite(p_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_uid     UUID := auth.uid();
    v_group   UUID;
    v_expires TIMESTAMPTZ;
    v_revoked BOOLEAN;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'must be authenticated';
    END IF;

    SELECT group_id, expires_at, revoked
    INTO v_group, v_expires, v_revoked
    FROM public.invite_links
    WHERE token = p_token;

    IF v_group IS NULL THEN
        RAISE EXCEPTION 'invalid invite token';
    END IF;
    IF v_revoked THEN
        RAISE EXCEPTION 'invite token revoked';
    END IF;
    IF v_expires < now() THEN
        RAISE EXCEPTION 'invite token expired';
    END IF;

    -- If user previously left/was removed, re-activate that row; otherwise insert.
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group, v_uid, 'member')
    ON CONFLICT (group_id, user_id) DO UPDATE
        SET removed_at = NULL,
            joined_at  = now();

    -- Notify all admins that someone joined.
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT gm.user_id, 'MEMBER_JOINED',
           jsonb_build_object('group_id', v_group, 'actor_id', v_uid)
    FROM public.group_members gm
    WHERE gm.group_id = v_group AND gm.role = 'admin' AND gm.user_id <> v_uid AND gm.removed_at IS NULL;

    -- Notify the joiner.
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (v_uid, 'GROUP_JOINED', jsonb_build_object('group_id', v_group));

    RETURN v_group;
END;
$$;

------------------------------------------------------------
-- request_repayments: debtor batches one or more repayment requests.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_repayments(
    p_group_id        UUID,
    p_items           JSONB,    -- [{creditor_id, amount, currency, description}, ...]
    p_idempotency_key TEXT
) RETURNS UUID[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_uid    UUID := auth.uid();
    v_item   JSONB;
    v_id     UUID;
    v_ids    UUID[] := ARRAY[]::UUID[];
    v_seq    INT := 0;
    v_key    TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'must be authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a group member';
    END IF;
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'no repayment items provided';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_seq := v_seq + 1;
        -- Per-item key derived from the request idempotency key + index for stable retry.
        v_key := p_idempotency_key || ':' || v_seq;

        -- If a row with this key already exists, return it (idempotency).
        SELECT id INTO v_id FROM public.repayments WHERE idempotency_key = v_key;
        IF v_id IS NOT NULL THEN
            v_ids := array_append(v_ids, v_id);
            CONTINUE;
        END IF;

        INSERT INTO public.repayments (
            group_id, debtor_id, creditor_id, amount, currency, description,
            status, idempotency_key
        )
        VALUES (
            p_group_id,
            v_uid,
            (v_item->>'creditor_id')::UUID,
            (v_item->>'amount')::BIGINT,
            (v_item->>'currency')::CHAR(3),
            v_item->>'description',
            'PENDING',
            v_key
        )
        RETURNING id INTO v_id;

        v_ids := array_append(v_ids, v_id);

        -- Notify creditor.
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (
            (v_item->>'creditor_id')::UUID,
            'REPAYMENT_REQUEST',
            jsonb_build_object(
                'group_id', p_group_id,
                'repayment_id', v_id,
                'debtor_id', v_uid,
                'amount', (v_item->>'amount')::BIGINT,
                'currency', v_item->>'currency'
            )
        );
    END LOOP;

    RETURN v_ids;
END;
$$;

------------------------------------------------------------
-- accept_repayment / reject_repayment / cancel_repayment
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_repayment(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_row public.repayments;
BEGIN
    SELECT * INTO v_row FROM public.repayments WHERE id = p_id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'repayment not found'; END IF;
    IF v_row.creditor_id <> auth.uid() THEN RAISE EXCEPTION 'only creditor can accept'; END IF;
    IF v_row.status <> 'PENDING' THEN RAISE EXCEPTION 'repayment is not pending'; END IF;

    UPDATE public.repayments
    SET status = 'ACCEPTED', settled_at = now()
    WHERE id = p_id;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
        v_row.debtor_id,
        'REPAYMENT_ACCEPTED',
        jsonb_build_object(
            'group_id', v_row.group_id,
            'repayment_id', v_row.id,
            'creditor_id', v_row.creditor_id,
            'amount', v_row.amount,
            'currency', v_row.currency
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_repayment(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_row public.repayments;
BEGIN
    SELECT * INTO v_row FROM public.repayments WHERE id = p_id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'repayment not found'; END IF;
    IF v_row.creditor_id <> auth.uid() THEN RAISE EXCEPTION 'only creditor can reject'; END IF;
    IF v_row.status <> 'PENDING' THEN RAISE EXCEPTION 'repayment is not pending'; END IF;

    UPDATE public.repayments SET status = 'REJECTED' WHERE id = p_id;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
        v_row.debtor_id,
        'REPAYMENT_REJECTED',
        jsonb_build_object(
            'group_id', v_row.group_id,
            'repayment_id', v_row.id,
            'creditor_id', v_row.creditor_id
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_repayment(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_row public.repayments;
BEGIN
    SELECT * INTO v_row FROM public.repayments WHERE id = p_id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'repayment not found'; END IF;
    IF v_row.debtor_id <> auth.uid() THEN RAISE EXCEPTION 'only debtor can cancel'; END IF;
    IF v_row.status <> 'PENDING' THEN RAISE EXCEPTION 'repayment is not pending'; END IF;

    UPDATE public.repayments SET status = 'CANCELLED' WHERE id = p_id;
END;
$$;

------------------------------------------------------------
-- get_member_balance_summary: per-currency balance for a single member in a group.
-- Used by the remove-member flow to render the warning modal.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_member_balance_summary(p_group_id UUID, p_user_id UUID)
RETURNS TABLE (currency CHAR(3), net_balance BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
    SELECT currency, net_balance
    FROM public.group_balances
    WHERE group_id = p_group_id AND user_id = p_user_id AND net_balance <> 0;
$$;

------------------------------------------------------------
-- remove_member: admin removes a member; voids pending repayments and detaches
-- their splits from non-deleted expenses by recording a soft removal.
-- The member's expense_splits remain (history is frozen) but the membership row
-- is marked removed_at so RLS cuts off access.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_member(p_group_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
    IF NOT public.is_group_admin(p_group_id) THEN
        RAISE EXCEPTION 'only group admin can remove members';
    END IF;
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'admin cannot remove self; transfer admin first or delete the group';
    END IF;

    UPDATE public.group_members
    SET removed_at = now()
    WHERE group_id = p_group_id AND user_id = p_user_id AND removed_at IS NULL;

    -- Cancel any pending repayments involving this user in this group.
    UPDATE public.repayments
    SET status = 'CANCELLED'
    WHERE group_id = p_group_id
      AND status = 'PENDING'
      AND (debtor_id = p_user_id OR creditor_id = p_user_id);

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
        p_user_id,
        'GROUP_REMOVED',
        jsonb_build_object('group_id', p_group_id, 'actor_id', auth.uid())
    );
END;
$$;
