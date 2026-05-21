"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { DeleteExpenseButton } from "@/components/expenses/DeleteExpenseButton";
import { formatAmount } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import type { ExpenseRow, UserRow } from "@/types/database";

interface ExpenseWithSplit extends ExpenseRow {
  my_share?: number;
}

export function ExpensesTab({
  groupId,
  me,
  isAdmin,
  expenses,
  profileById,
}: {
  groupId: string;
  me: string;
  isAdmin: boolean;
  expenses: ExpenseWithSplit[];
  profileById: Map<string, UserRow>;
}) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-8 w-8" />}
        title="No expenses yet"
        description="Tap the + button to add your first shared expense."
        action={
          <Button asChild>
            <Link href={`/groups/${groupId}/expenses/new`}>Add expense</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-2">
      {expenses.map((e) => {
        const payer = profileById.get(e.paid_by);
        const isMyPayment = e.paid_by === me;
        const myShare = e.my_share ?? 0;
        const canDelete = isAdmin || e.created_by === me;

        return (
          <li
            key={e.id}
            className="rounded-xl border bg-card p-3"
            aria-label={`Expense ${e.name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isMyPayment
                    ? "You paid"
                    : `${payer?.full_name ?? "Someone"} paid`}{" "}
                  {formatAmount(e.amount, e.currency)} ·{" "}
                  {relativeTime(e.created_at)}
                </p>
              </div>
              <div className="flex items-start gap-1">
                <div className="text-right">
                  {myShare > 0 ? (
                    isMyPayment ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        lent {formatAmount(BigInt(e.amount) - BigInt(myShare), e.currency)}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                        you owe {formatAmount(myShare, e.currency)}
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">not in split</p>
                  )}
                </div>
                <DeleteExpenseButton
                  expenseId={e.id}
                  expenseName={e.name}
                  canDelete={canDelete}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
