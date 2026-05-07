import "server-only";
import { getCachedUser } from "@/lib/supabase/server";

/**
 * Verify the current request's user via the cookie-based server client.
 * Returns the auth user id or null. Use this in every server action before
 * touching the admin client.
 */
export async function getAuthedUser(): Promise<{ id: string; email: string } | null> {
  const user = await getCachedUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}
