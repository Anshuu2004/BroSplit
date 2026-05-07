-- Notification fan-out triggers.

------------------------------------------------------------
-- EXPENSE_ADDED → row-level trigger on expense_splits.
-- Fires once per participant; we suppress the creator's own notification.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_expense_split_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_e public.expenses;
BEGIN
    SELECT * INTO v_e FROM public.expenses WHERE id = NEW.expense_id;
    IF v_e.id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.user_id <> v_e.created_by THEN
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (
            NEW.user_id,
            'EXPENSE_ADDED',
            jsonb_build_object(
                'group_id', v_e.group_id,
                'expense_id', v_e.id,
                'name', v_e.name,
                'amount', v_e.amount,
                'currency', v_e.currency,
                'actor_id', v_e.created_by
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_split_added ON public.expense_splits;
CREATE TRIGGER trg_expense_split_added
AFTER INSERT ON public.expense_splits
FOR EACH ROW EXECUTE FUNCTION public.notify_expense_split_added();

------------------------------------------------------------
-- EXPENSE_DELETED (soft delete via deleted_at)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_expense_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        INSERT INTO public.notifications (user_id, type, payload)
        SELECT DISTINCT s.user_id, 'EXPENSE_DELETED',
               jsonb_build_object(
                   'group_id', NEW.group_id,
                   'expense_id', NEW.id,
                   'name', NEW.name,
                   'actor_id', auth.uid()
               )
        FROM public.expense_splits s
        WHERE s.expense_id = NEW.id AND s.user_id <> auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_deleted ON public.expenses;
CREATE TRIGGER trg_expense_deleted
AFTER UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.notify_expense_deleted();
