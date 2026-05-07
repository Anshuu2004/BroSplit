import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupTabs } from "@/components/groups/GroupTabs";
import { InviteButton } from "@/components/groups/InviteButton";
import { fetchGroupDetail } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseRow, RepaymentRow } from "@/types/database";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchGroupDetail(id);
  if (!detail) notFound();

  const supabase = await createClient();

  // Parallel fetch: expenses + repayment history
  const [expensesRes, historyRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("group_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("repayments")
      .select("*")
      .eq("group_id", id)
      .neq("status", "PENDING")
      .order("settled_at", { ascending: false, nullsFirst: false })
      .order("requested_at", { ascending: false })
      .limit(100),
  ]);

  const expensesRaw = expensesRes.data;
  const expenseIds = (expensesRaw ?? []).map((e) => e.id);

  const mySplitsRes =
    expenseIds.length > 0
      ? await supabase
          .from("expense_splits")
          .select("expense_id, share")
          .eq("user_id", detail.me)
          .in("expense_id", expenseIds)
      : { data: [] as { expense_id: string; share: number }[] };

  const myShareByExpense = new Map<string, number>(
    (mySplitsRes.data ?? []).map((s) => [s.expense_id as string, Number(s.share)])
  );

  const expenses = (expensesRaw ?? []).map((e) => ({
    ...(e as ExpenseRow),
    my_share: myShareByExpense.get(e.id) ?? 0,
  }));

  const history = historyRes.data;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {detail.group.name}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.members.length} member
              {detail.members.length === 1 ? "" : "s"} · primary{" "}
              {detail.group.primary_currency}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InviteButton groupId={id} />
            <Button asChild variant="ghost" size="icon" aria-label="Group settings">
              <Link href={`/groups/${id}/settings`}>
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        <ul className="-mx-1 flex flex-wrap gap-2">
          {detail.members.map((m) => {
            const u = detail.profileById.get(m.user_id);
            return (
              <li
                key={m.user_id}
                className="flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs"
                title={u?.full_name ?? m.user_id}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {initials(u?.full_name ?? "?")}
                </span>
                <span className="truncate max-w-[120px]">
                  {u?.full_name ?? "Unknown"}
                </span>
                {m.role === "admin" ? (
                  <span className="rounded bg-primary/10 px-1 text-[10px] font-bold uppercase text-primary">
                    admin
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild>
            <Link href={`/groups/${id}/expenses/new`}>
              <Plus className="mr-1 h-4 w-4" /> Add expense
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/groups/${id}/settle`}>Settle up</Link>
          </Button>
        </div>
      </header>

      <GroupTabs
        groupId={id}
        me={detail.me}
        balances={detail.balances}
        expenses={expenses}
        history={(history ?? []) as RepaymentRow[]}
        profileMap={Array.from(detail.profileById.entries())}
      />
    </div>
  );
}
