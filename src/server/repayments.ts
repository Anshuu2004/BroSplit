"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  repaymentIdSchema,
  requestRepaymentsSchema,
} from "@/lib/validators";
import { safeAmountNumber } from "@/lib/utils";
import { getAuthedUser } from "./auth";

type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/**
 * requestRepaymentsAction
 *
 * Delegates to the `request_repayments` RPC, which inserts the rows atomically,
 * honours the per-item idempotency key, and fans out REPAYMENT_REQUEST
 * notifications.
 */
export async function requestRepaymentsAction(
  input: unknown
): Promise<Result<{ ids: string[] }>> {
  const parsed = requestRepaymentsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  // Self-repayment is a logic error the schema can't catch.
  for (const it of parsed.data.items) {
    if (it.creditor_id === user.id) {
      return { ok: false, message: "Cannot repay yourself" };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_repayments", {
    p_group_id: parsed.data.group_id,
    p_items: parsed.data.items.map((it) => ({
      creditor_id: it.creditor_id,
      amount: safeAmountNumber(it.amount, "repayment amount"),
      currency: it.currency,
      description: it.description ?? null,
    })),
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Couldn't create repayment",
    };
  }

  revalidatePath(`/groups/${parsed.data.group_id}`);
  revalidatePath("/notifications");
  return { ok: true, data: { ids: data as string[] } };
}

/**
 * acceptRepaymentAction — uses the RPC which takes a row lock (FOR UPDATE) so
 * concurrent accepts can't double-credit a balance.
 */
export async function acceptRepaymentAction(
  repaymentId: string
): Promise<Result> {
  const parsed = repaymentIdSchema.safeParse({ repayment_id: repaymentId });
  if (!parsed.success) {
    return { ok: false, message: "Invalid repayment id" };
  }
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_repayment", {
    p_id: parsed.data.repayment_id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/notifications");
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function rejectRepaymentAction(
  repaymentId: string
): Promise<Result> {
  const parsed = repaymentIdSchema.safeParse({ repayment_id: repaymentId });
  if (!parsed.success) {
    return { ok: false, message: "Invalid repayment id" };
  }
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_repayment", {
    p_id: parsed.data.repayment_id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/notifications");
  return { ok: true, data: null };
}
