import "server-only";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client for trusted server-side mutations.
 * This BYPASSES RLS — only use after you have authenticated the user
 * via the cookie-based server client (`lib/supabase/server.ts`) and
 * confirmed `auth.getUser()` returned a real user.
 *
 * Never import this from client code; the `server-only` import will fail the build.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase admin credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  // See lib/supabase/server.ts for the generic-mismatch background.
  const client = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client as unknown as SupabaseClient<Database>;
}
