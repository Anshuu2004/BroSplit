import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  // The <Database> generic on createServerClient does not wire through to the
  // returned client in the installed @supabase/ssr × supabase-js pair (the
  // generic parameter order on SupabaseClient changed in supabase-js).
  // Cast the return so .from()/.rpc() pick up our schema.
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only context (e.g. RSC) — middleware refreshes the session.
          }
        },
      },
    }
  );
  return client as unknown as SupabaseClient<Database>;
}

/**
 * Per-request cached current user.
 *
 * The middleware revalidates the session with `getUser()` before any route
 * handler runs, so by the time we reach a page or action the cookie is
 * trustworthy. We still go through `getUser()` here — `cache()` collapses
 * concurrent reads to a single Auth round-trip per request.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});
