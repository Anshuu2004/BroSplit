-- Row-Level Security policies. RLS is the primary authorization layer.
-- App-layer checks are defense-in-depth, never the source of truth.

------------------------------------------------------------
-- HELPER FUNCTIONS
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(g UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = g
          AND user_id = auth.uid()
          AND removed_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(g UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = g
          AND user_id = auth.uid()
          AND role = 'admin'
          AND removed_at IS NULL
    );
$$;

------------------------------------------------------------
-- ENABLE RLS
------------------------------------------------------------
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- USERS
------------------------------------------------------------
CREATE POLICY users_self_read ON public.users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY users_co_member_read ON public.users
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.group_members gm1
        JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid()
          AND gm2.user_id = users.id
          AND gm1.removed_at IS NULL
          AND gm2.removed_at IS NULL
    ));

CREATE POLICY users_self_update ON public.users
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

------------------------------------------------------------
-- GROUPS
------------------------------------------------------------
CREATE POLICY groups_member_read ON public.groups
    FOR SELECT USING (public.is_group_member(id));

CREATE POLICY groups_create ON public.groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY groups_admin_update ON public.groups
    FOR UPDATE USING (public.is_group_admin(id));

CREATE POLICY groups_admin_delete ON public.groups
    FOR DELETE USING (public.is_group_admin(id));

------------------------------------------------------------
-- GROUP_MEMBERS
------------------------------------------------------------
CREATE POLICY gm_read ON public.group_members
    FOR SELECT USING (public.is_group_member(group_id));

CREATE POLICY gm_admin_write ON public.group_members
    FOR ALL USING (public.is_group_admin(group_id))
              WITH CHECK (public.is_group_admin(group_id));

-- Allow a user to leave their own group (delete their own row, even if not admin).
CREATE POLICY gm_self_leave ON public.group_members
    FOR DELETE USING (user_id = auth.uid());

------------------------------------------------------------
-- INVITE_LINKS
------------------------------------------------------------
-- Admins manage; the consume_invite RPC handles redemption with SECURITY DEFINER
-- to avoid token enumeration via SELECT.
CREATE POLICY inv_admin_all ON public.invite_links
    FOR ALL USING (public.is_group_admin(group_id))
              WITH CHECK (public.is_group_admin(group_id));

------------------------------------------------------------
-- EXPENSES
------------------------------------------------------------
CREATE POLICY exp_read ON public.expenses
    FOR SELECT USING (public.is_group_member(group_id));

CREATE POLICY exp_insert ON public.expenses
    FOR INSERT WITH CHECK (
        public.is_group_member(group_id) AND created_by = auth.uid()
    );

CREATE POLICY exp_modify ON public.expenses
    FOR UPDATE USING (
        created_by = auth.uid() OR public.is_group_admin(group_id)
    );

CREATE POLICY exp_delete ON public.expenses
    FOR DELETE USING (
        created_by = auth.uid() OR public.is_group_admin(group_id)
    );

------------------------------------------------------------
-- EXPENSE_SPLITS
------------------------------------------------------------
CREATE POLICY es_read ON public.expense_splits
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id = expense_splits.expense_id
          AND public.is_group_member(e.group_id)
    ));

CREATE POLICY es_write ON public.expense_splits
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id = expense_splits.expense_id
          AND e.created_by = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id = expense_splits.expense_id
          AND e.created_by = auth.uid()
    ));

------------------------------------------------------------
-- REPAYMENTS
------------------------------------------------------------
CREATE POLICY rp_read ON public.repayments
    FOR SELECT USING (
        debtor_id = auth.uid()
        OR creditor_id = auth.uid()
        OR public.is_group_member(group_id)
    );

CREATE POLICY rp_insert ON public.repayments
    FOR INSERT WITH CHECK (
        debtor_id = auth.uid() AND public.is_group_member(group_id)
    );

CREATE POLICY rp_update ON public.repayments
    FOR UPDATE USING (
        (creditor_id = auth.uid() AND status = 'PENDING')
        OR (debtor_id = auth.uid() AND status = 'PENDING')
    );

------------------------------------------------------------
-- NOTIFICATIONS
------------------------------------------------------------
CREATE POLICY notif_self ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notif_self_update ON public.notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
