-- Enable Supabase Realtime broadcasts for the tables the client subscribes to.
-- Realtime respects RLS (see migration 0002), so the policies in place gate
-- which rows each subscriber actually receives.
--
-- Idempotent: each ADD TABLE is guarded against the table already being a
-- member of supabase_realtime, so re-running this migration is safe.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['expenses', 'expense_splits', 'repayments', 'notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
