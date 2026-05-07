"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { simplifyDebts } from "@/lib/algos/simplifyDebts";
import { balancesByCurrency } from "@/lib/algos/netBalance";
import { formatAmount } from "@/lib/currency";
import type { GroupBalanceRow, UserRow } from "@/types/database";
import { initials } from "@/lib/utils";

interface Props {
  groupId: string;
  me: string;
  balances: GroupBalanceRow[];
  profileById: Map<string, UserRow>;
}

export function BalancesTab({ groupId, me, balances, profileById }: Props) {
  const byCcy = balancesByCurrency(balances, groupId);

  if (byCcy.size === 0) {
    return (
      <EmptyState
        title="No balances yet"
        description="Add an expense to start tracking who owes what."
      />
    );
  }

  // For each currency: simplify, filter for transfers involving the current user.
  const sections = Array.from(byCcy.entries()).map(([ccy, map]) => {
    const transfers = simplifyDebts(map);
    const meOwes = transfers.filter((t) => t.from === me);
    const owedToMe = transfers.filter((t) => t.to === me);
    const others = transfers.filter((t) => t.from !== me && t.to !== me);
    return { ccy, meOwes, owedToMe, others };
  });

  return (
    <div className="space-y-4">
      {sections.map(({ ccy, meOwes, owedToMe, others }) => (
        <section key={ccy} aria-label={`${ccy} balances`}>
          <header className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {ccy} balances
            </h3>
          </header>

          {meOwes.length === 0 && owedToMe.length === 0 && others.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                You're settled in {ccy}.
              </CardContent>
            </Card>
          ) : null}

          <ul className="space-y-2">
            {owedToMe.map((t) => {
              const u = profileById.get(t.from);
              return (
                <li
                  key={`${t.from}-${t.to}-${t.amount}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-xs font-semibold text-primary">
                    {initials(u?.full_name ?? "?")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{u?.full_name ?? "Unknown"}</span>{" "}
                      owes you
                    </p>
                    <p className="text-base font-semibold tabular-nums text-primary">
                      {formatAmount(t.amount, ccy)}
                    </p>
                  </div>
                </li>
              );
            })}
            {meOwes.map((t) => {
              const u = profileById.get(t.to);
              return (
                <li
                  key={`${t.from}-${t.to}-${t.amount}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-xs font-semibold text-destructive">
                    {initials(u?.full_name ?? "?")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      You owe{" "}
                      <span className="font-medium">{u?.full_name ?? "Unknown"}</span>
                    </p>
                    <p className="text-base font-semibold tabular-nums text-destructive">
                      {formatAmount(t.amount, ccy)}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/groups/${groupId}/settle`}>Settle</Link>
                  </Button>
                </li>
              );
            })}
            {others.map((t) => {
              const from = profileById.get(t.from);
              const to = profileById.get(t.to);
              return (
                <li
                  key={`o-${t.from}-${t.to}-${t.amount}`}
                  className="rounded-xl border bg-card p-3 text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {from?.full_name ?? "Unknown"}
                  </span>{" "}
                  owes{" "}
                  <span className="font-medium text-foreground">
                    {to?.full_name ?? "Unknown"}
                  </span>{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatAmount(t.amount, ccy)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
