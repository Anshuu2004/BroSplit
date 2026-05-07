import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
}

/**
 * Per-request cached current user.
 *
 * Reads the session from cookies (no network call). The middleware uses the
 * stricter `getUser()` for security and refreshes the session — by the time we
 * reach a page or action, the cookie has already been validated for the
 * current request. This call is just to identify *who* the user is.
 *
 * Saves ~150 ms vs. `getUser()` because it doesn't hit the Supabase Auth API.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return session.user;
});
