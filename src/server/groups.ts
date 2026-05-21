"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken } from "@/lib/utils";
import {
  createGroupSchema,
  groupIdSchema,
  memberRefSchema,
} from "@/lib/validators";
import { z } from "zod";
import { getAuthedUser } from "./auth";

type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/* -------------------------------------------------------------------------- */
/* createGroupAction                                                          */
/* RLS allows: anyone may create a group where created_by = auth.uid().       */
/* We then add the creator as admin via the same authenticated session.       */
/* -------------------------------------------------------------------------- */

export async function createGroupAction(
  input: unknown
): Promise<Result<{ id: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { data: group, error } = await supabase
    .from("groups")
    .insert({
      name: parsed.data.name,
      primary_currency: parsed.data.primary_currency,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !group) {
    return {
      ok: false,
      message: error?.message ?? "Couldn't create the group.",
    };
  }
  const { error: memberErr } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "admin" });
  if (memberErr) {
    return {
      ok: false,
      message: `Group created but couldn't add you as admin: ${memberErr.message}`,
    };
  }
  revalidatePath("/");
  return { ok: true, data: { id: group.id as string } };
}

/* -------------------------------------------------------------------------- */
/* generateInviteAction — admin-only by RLS (inv_admin_all).                  */
/* -------------------------------------------------------------------------- */

export async function generateInviteAction(
  groupId: string
): Promise<Result<{ token: string; expires_at: string }>> {
  const parsed = groupIdSchema.safeParse({ group_id: groupId });
  if (!parsed.success) return { ok: false, message: "Invalid group id" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("invite_links").insert({
    token,
    group_id: parsed.data.group_id,
    created_by: user.id,
    expires_at: expiresAt,
  });
  if (error) {
    // RLS will reject if the caller is not an admin — surface that cleanly.
    return { ok: false, message: error.message };
  }
  return { ok: true, data: { token, expires_at: expiresAt } };
}

/* -------------------------------------------------------------------------- */
/* deleteGroupAction — admin-only update; RLS gates.                          */
/* -------------------------------------------------------------------------- */

export async function deleteGroupAction(groupId: string): Promise<Result> {
  const parsed = groupIdSchema.safeParse({ group_id: groupId });
  if (!parsed.success) return { ok: false, message: "Invalid group id" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.group_id)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return { ok: false, message: "Only the group admin can delete the group" };
  }
  revalidatePath("/");
  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* getMemberBalanceSummaryAction — uses the RPC; RLS gates membership.        */
/* -------------------------------------------------------------------------- */

export async function getMemberBalanceSummaryAction(
  groupId: string,
  memberId: string
): Promise<Result<{ currency: string; net_balance: number }[]>> {
  const parsed = memberRefSchema.safeParse({
    group_id: groupId,
    user_id: memberId,
  });
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_member_balance_summary", {
    p_group_id: parsed.data.group_id,
    p_user_id: parsed.data.user_id,
  });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: (data ?? []) as { currency: string; net_balance: number }[],
  };
}

/* -------------------------------------------------------------------------- */
/* removeMemberAction — admin removes someone else, via the RPC.              */
/* -------------------------------------------------------------------------- */

export async function removeMemberAction(
  groupId: string,
  memberId: string
): Promise<Result> {
  const parsed = memberRefSchema.safeParse({
    group_id: groupId,
    user_id: memberId,
  });
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_group_id: parsed.data.group_id,
    p_user_id: parsed.data.user_id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/groups/${parsed.data.group_id}`);
  revalidatePath(`/groups/${parsed.data.group_id}/settings`);
  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* leaveGroupAction — caller removes themselves via the leave_group RPC.      */
/* The RPC refuses if the caller is the sole admin.                           */
/* -------------------------------------------------------------------------- */

export async function leaveGroupAction(groupId: string): Promise<Result> {
  const parsed = groupIdSchema.safeParse({ group_id: groupId });
  if (!parsed.success) return { ok: false, message: "Invalid group id" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", {
    p_group_id: parsed.data.group_id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* joinByTokenAction — wraps the consume_invite RPC (which fans out notifs).  */
/* -------------------------------------------------------------------------- */

const joinTokenSchema = z.object({ token: z.string().min(1).max(64) });

export async function joinByTokenAction(
  token: string
): Promise<Result<{ group_id: string }>> {
  const parsed = joinTokenSchema.safeParse({ token });
  if (!parsed.success) return { ok: false, message: "Invalid invite token" };

  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_invite", {
    p_token: parsed.data.token,
  });
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Couldn't redeem invite" };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${data as string}`);
  return { ok: true, data: { group_id: data as string } };
}
