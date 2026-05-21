"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createExpenseSchema,
  deleteExpenseSchema,
} from "@/lib/validators";
import { safeAmountNumber } from "@/lib/utils";
import { getAuthedUser } from "./auth";

type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/**
 * createExpenseAction
 *
 * Delegates to the `create_expense` RPC (SECURITY INVOKER), which performs
 * membership/role checks under RLS, writes the expense + splits atomically,
 * and honours the idempotency key (a double-submit returns the same id).
 */
export async function createExpenseAction(
  input: unknown
): Promise<Result<{ expense_id: string }>> {
  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_expense", {
    p_group_id: parsed.data.group_id,
    p_name: parsed.data.name,
    p_amount: safeAmountNumber(parsed.data.amount, "expense amount"),
    p_currency: parsed.data.currency,
    p_paid_by: parsed.data.paid_by,
    p_participants: parsed.data.participants,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Couldn't create the expense",
    };
  }

  revalidatePath(`/groups/${parsed.data.group_id}`);
  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, data: { expense_id: data as string } };
}

/**
 * deleteExpenseAction
 *
 * Soft-deletes via the `delete_expense` RPC; the RPC enforces creator-or-admin
 * via RLS and emits an EXPENSE_DELETED notification through the trigger.
 */
export async function deleteExpenseAction(input: unknown): Promise<Result> {
  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();

  // Look up group_id first so we can revalidate the right paths.
  const { data: e } = await supabase
    .from("expenses")
    .select("group_id")
    .eq("id", parsed.data.expense_id)
    .maybeSingle();

  const { error } = await supabase.rpc("delete_expense", {
    p_expense_id: parsed.data.expense_id,
  });
  if (error) return { ok: false, message: error.message };

  if (e?.group_id) revalidatePath(`/groups/${e.group_id}`);
  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, data: null };
}
