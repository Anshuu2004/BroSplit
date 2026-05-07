"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitEqual } from "@/lib/algos/splitEqual";
import { getAuthedUser } from "./auth";

type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

interface CreateExpenseInput {
  group_id: string;
  name: string;
  amount: string; // string of digits, validated below
  currency: string;
  paid_by: string;
  participants: string[];
}

export async function createExpenseAction(
  input: CreateExpenseInput
): Promise<Result<{ expense_id: string }>> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const name = input.name?.trim() ?? "";
  if (!name || name.length > 100) {
    return { ok: false, message: "Expense name must be 1–100 characters" };
  }
  if (!/^\d+$/.test(input.amount) || input.amount === "0") {
    return { ok: false, message: "Amount must be a positive whole number" };
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    return { ok: false, message: "Currency code must be 3 letters" };
  }
  if (!Array.isArray(input.participants) || input.participants.length < 1) {
    return { ok: false, message: "Pick at least one participant" };
  }

  const admin = createAdminClient();

  // Verify caller is a current member.
  const { data: callerMembership } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", input.group_id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!callerMembership) return { ok: false, message: "Not a group member" };

  // Verify all participants + paid_by are current members.
  const memberCheckIds = Array.from(
    new Set([input.paid_by, ...input.participants])
  );
  const { data: members } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", input.group_id)
    .is("removed_at", null)
    .in("user_id", memberCheckIds);
  const memberSet = new Set((members ?? []).map((m) => m.user_id as string));
  for (const id of memberCheckIds) {
    if (!memberSet.has(id)) {
      return {
        ok: false,
        message: "All participants and the payer must be current group members",
      };
    }
  }

  const amountBig = BigInt(input.amount);

  // Insert expense
  const { data: expense, error: expErr } = await admin
    .from("expenses")
    .insert({
      group_id: input.group_id,
      name,
      amount: Number(amountBig),
      currency: input.currency,
      paid_by: input.paid_by,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (expErr || !expense) {
    return {
      ok: false,
      message: expErr?.message ?? "Couldn't create the expense",
    };
  }

  const expenseId = expense.id as string;
  const splits = splitEqual(amountBig, input.participants);

  const { error: splitErr } = await admin.from("expense_splits").insert(
    splits.map((s) => ({
      expense_id: expenseId,
      user_id: s.user_id,
      share: Number(s.share),
      is_remainder_payer: s.is_remainder_payer,
    }))
  );
  if (splitErr) {
    // Roll back the expense to keep ledger consistent.
    await admin.from("expenses").delete().eq("id", expenseId);
    return {
      ok: false,
      message: `Couldn't write splits: ${splitErr.message}`,
    };
  }

  revalidatePath(`/groups/${input.group_id}`);
  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, data: { expense_id: expenseId } };
}
