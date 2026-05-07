"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteToken } from "@/lib/utils";
import { createGroupSchema } from "@/lib/validators";
import { getAuthedUser } from "./auth";

type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/* -------------------------------------------------------------------------- */
/* createGroup                                                                */
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

  const admin = createAdminClient();
  const { data: group, error } = await admin
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
  const { error: memberErr } = await admin
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
/* Authorization helpers                                                      */
/* -------------------------------------------------------------------------- */

async function isAdmin(groupId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();
  return data?.role === "admin";
}

async function isMember(groupId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();
  return !!data;
}

/* -------------------------------------------------------------------------- */
/* generateInvite                                                             */
/* -------------------------------------------------------------------------- */

export async function generateInviteAction(
  groupId: string
): Promise<Result<{ token: string; expires_at: string }>> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!(await isAdmin(groupId, user.id))) {
    return { ok: false, message: "Only the group admin can create invites" };
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("invite_links").insert({
    token,
    group_id: groupId,
    created_by: user.id,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { token, expires_at: expiresAt } };
}

/* -------------------------------------------------------------------------- */
/* deleteGroup                                                                */
/* -------------------------------------------------------------------------- */

export async function deleteGroupAction(groupId: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!(await isAdmin(groupId, user.id))) {
    return { ok: false, message: "Only the group admin can delete the group" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", groupId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* getMemberBalanceSummary                                                    */
/* -------------------------------------------------------------------------- */

export async function getMemberBalanceSummaryAction(
  groupId: string,
  memberId: string
): Promise<Result<{ currency: string; net_balance: number }[]>> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!(await isAdmin(groupId, user.id))) {
    return { ok: false, message: "Only the group admin can view this" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_balances")
    .select("currency, net_balance")
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .neq("net_balance", 0);
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: (data ?? []) as { currency: string; net_balance: number }[],
  };
}

/* -------------------------------------------------------------------------- */
/* removeMember                                                               */
/* -------------------------------------------------------------------------- */

export async function removeMemberAction(
  groupId: string,
  memberId: string
): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!(await isAdmin(groupId, user.id))) {
    return { ok: false, message: "Only the group admin can remove members" };
  }
  if (memberId === user.id) {
    return {
      ok: false,
      message: "Admin cannot remove self. Delete the group instead.",
    };
  }

  const admin = createAdminClient();

  const { error: rmErr } = await admin
    .from("group_members")
    .update({ removed_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .is("removed_at", null);
  if (rmErr) return { ok: false, message: rmErr.message };

  // Cancel pending repayments involving this member in this group.
  await admin
    .from("repayments")
    .update({ status: "CANCELLED" })
    .eq("group_id", groupId)
    .eq("status", "PENDING")
    .or(`debtor_id.eq.${memberId},creditor_id.eq.${memberId}`);

  // Notify the removed member.
  await admin.from("notifications").insert({
    user_id: memberId,
    type: "GROUP_REMOVED",
    payload: { group_id: groupId, actor_id: user.id },
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* joinGroupByToken (used by /join/[token] page)                              */
/* -------------------------------------------------------------------------- */

export async function joinByTokenAction(
  token: string
): Promise<Result<{ group_id: string }>> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: link, error } = await admin
    .from("invite_links")
    .select("group_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!link) return { ok: false, message: "Invalid invite token" };
  if (link.revoked) return { ok: false, message: "Invite link revoked" };
  if (new Date(link.expires_at as string) < new Date()) {
    return { ok: false, message: "Invite link expired" };
  }

  // Upsert membership: if previously removed, restore; else insert.
  const { error: upErr } = await admin.from("group_members").upsert(
    {
      group_id: link.group_id as string,
      user_id: user.id,
      role: "member",
      joined_at: new Date().toISOString(),
      removed_at: null,
    },
    { onConflict: "group_id,user_id" }
  );
  if (upErr) return { ok: false, message: upErr.message };

  // Notify admins + the joiner.
  const { data: admins } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", link.group_id as string)
    .eq("role", "admin")
    .is("removed_at", null);

  const notifs = [
    ...(admins ?? [])
      .filter((a) => a.user_id !== user.id)
      .map((a) => ({
        user_id: a.user_id as string,
        type: "MEMBER_JOINED" as const,
        payload: { group_id: link.group_id, actor_id: user.id },
      })),
    {
      user_id: user.id,
      type: "GROUP_JOINED" as const,
      payload: { group_id: link.group_id },
    },
  ];
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  revalidatePath("/");
  revalidatePath(`/groups/${link.group_id}`);
  return { ok: true, data: { group_id: link.group_id as string } };
}
