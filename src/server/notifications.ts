"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "./auth";

type Result = { ok: true } | { ok: false; message: string };

export async function markNotificationReadAction(
  notificationId: string
): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}
