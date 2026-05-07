"use client";

import { History } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatAmount } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import type { RepaymentRow, UserRow } from "@/types/database";

export function HistoryTab({
  me,
  history,
  profileById,
}: {
  me: string;
  history: RepaymentRow[];
  profileById: Map<string, UserRow>;
}) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-8 w-8" />}
        title="No settled repayments"
        description="Settled and rejected repayments will appear here."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {history.map((r) => {
        const debtor = profileById.get(r.debtor_id);
        const creditor = profileById.get(r.creditor_id);
        const me_is_debtor = r.debtor_id === me;
        const me_is_creditor = r.creditor_id === me;
        const subject = me_is_debtor
          ? `You paid ${creditor?.full_name ?? "someone"}`
          : me_is_creditor
            ? `${debtor?.full_name ?? "Someone"} paid you`
            : `${debtor?.full_name ?? "Someone"} → ${creditor?.full_name ?? "someone"}`;
        return (
          <li key={r.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.status} · {relativeTime(r.settled_at ?? r.requested_at)}
                  {r.description ? ` · ${r.description}` : ""}
                </p>
              </div>
              <p className="text-base font-semibold tabular-nums">
                {formatAmount(r.amount, r.currency)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
