"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "./auth";

type Result = { ok: true } | { ok: false; message: string };

const idSchema = z.object({ notification_id: z.string().uuid() });

export async function markNotificationReadAction(
  notificationId: string
): Promise<Result> {
  const parsed = idSchema.safeParse({ notification_id: notificationId });
  if (!parsed.success) return { ok: false, message: "Invalid notification id" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  // RLS `notif_self_update` restricts updates to the caller's own rows.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.notification_id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}
