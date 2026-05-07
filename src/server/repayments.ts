"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "./auth";

type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

interface RepaymentItem {
  creditor_id: string;
  amount: string; // digits
  currency: string;
  description?: string;
}

export async function requestRepaymentsAction(input: {
  group_id: string;
  items: RepaymentItem[];
  idempotency_key: string;
}): Promise<Result<{ ids: string[] }>> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!input.items || input.items.length === 0) {
    return { ok: false, message: "Pick at least one creditor" };
  }
  if (!input.idempotency_key) {
    return { ok: false, message: "Missing idempotency key" };
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", input.group_id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!membership) return { ok: false, message: "Not a group member" };

  // Validate items
  for (const it of input.items) {
    if (!/^\d+$/.test(it.amount) || it.amount === "0") {
      return {
        ok: false,
        message: "All amounts must be positive whole numbers",
      };
    }
    if (!/^[A-Z]{3}$/.test(it.currency)) {
      return { ok: false, message: "Currency code must be 3 letters" };
    }
    if (it.creditor_id === user.id) {
      return { ok: false, message: "Cannot repay yourself" };
    }
  }

  const ids: string[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    const key = `${input.idempotency_key}:${i + 1}`;

    // Idempotency: if already exists, return existing id.
    const { data: existing } = await admin
      .from("repayments")
      .select("id")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing?.id) {
      ids.push(existing.id as string);
      continue;
    }

    const { data: row, error } = await admin
      .from("repayments")
      .insert({
        group_id: input.group_id,
        debtor_id: user.id,
        creditor_id: it.creditor_id,
        amount: Number(BigInt(it.amount)),
        currency: it.currency,
        description: it.description ?? null,
        status: "PENDING",
        idempotency_key: key,
      })
      .select("id")
      .single();
    if (error || !row) {
      return {
        ok: false,
        message: error?.message ?? "Couldn't create repayment",
      };
    }
    ids.push(row.id as string);

    await admin.from("notifications").insert({
      user_id: it.creditor_id,
      type: "REPAYMENT_REQUEST",
      payload: {
        group_id: input.group_id,
        repayment_id: row.id,
        debtor_id: user.id,
        amount: Number(BigInt(it.amount)),
        currency: it.currency,
      },
    });
  }

  revalidatePath(`/groups/${input.group_id}`);
  revalidatePath("/notifications");
  return { ok: true, data: { ids } };
}

export async function acceptRepaymentAction(
  repaymentId: string
): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: r, error: readErr } = await admin
    .from("repayments")
    .select("*")
    .eq("id", repaymentId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!r) return { ok: false, message: "Repayment not found" };
  if (r.creditor_id !== user.id) {
    return { ok: false, message: "Only the creditor can accept this" };
  }
  if (r.status !== "PENDING") {
    return { ok: false, message: "Repayment is no longer pending" };
  }

  const { error } = await admin
    .from("repayments")
    .update({ status: "ACCEPTED", settled_at: new Date().toISOString() })
    .eq("id", repaymentId);
  if (error) return { ok: false, message: error.message };

  await admin.from("notifications").insert({
    user_id: r.debtor_id,
    type: "REPAYMENT_ACCEPTED",
    payload: {
      group_id: r.group_id,
      repayment_id: r.id,
      creditor_id: r.creditor_id,
      amount: r.amount,
      currency: r.currency,
    },
  });
  revalidatePath(`/groups/${r.group_id}`);
  revalidatePath("/notifications");
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function rejectRepaymentAction(
  repaymentId: string
): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: r } = await admin
    .from("repayments")
    .select("*")
    .eq("id", repaymentId)
    .maybeSingle();
  if (!r) return { ok: false, message: "Repayment not found" };
  if (r.creditor_id !== user.id) {
    return { ok: false, message: "Only the creditor can reject this" };
  }
  if (r.status !== "PENDING") {
    return { ok: false, message: "Repayment is no longer pending" };
  }

  const { error } = await admin
    .from("repayments")
    .update({ status: "REJECTED" })
    .eq("id", repaymentId);
  if (error) return { ok: false, message: error.message };

  await admin.from("notifications").insert({
    user_id: r.debtor_id,
    type: "REPAYMENT_REJECTED",
    payload: {
      group_id: r.group_id,
      repayment_id: r.id,
      creditor_id: r.creditor_id,
    },
  });
  revalidatePath(`/groups/${r.group_id}`);
  revalidatePath("/notifications");
  return { ok: true, data: null };
}
