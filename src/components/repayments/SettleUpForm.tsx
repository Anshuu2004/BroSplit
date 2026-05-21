"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/EmptyState";
import { simplifyDebts } from "@/lib/algos/simplifyDebts";
import { balancesByCurrency } from "@/lib/algos/netBalance";
import { formatAmount, symbolOf } from "@/lib/currency";
import { requestRepaymentsAction } from "@/server/repayments";
import { useToast } from "@/hooks/useToast";
import type { GroupBalanceRow, UserRow } from "@/types/database";

interface Props {
  groupId: string;
  me: string;
  balances: GroupBalanceRow[];
  profileMap: Array<[string, UserRow]>;
}

interface Row {
  key: string;
  creditorId: string;
  creditorName: string;
  currency: string;
  owed: bigint;
  amount: string;
  description: string;
  selected: boolean;
}

export function SettleUpForm({ groupId, me, balances, profileMap }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const profileById = useMemo(() => new Map(profileMap), [profileMap]);

  const initialRows: Row[] = useMemo(() => {
    const byCcy = balancesByCurrency(balances, groupId);
    const rows: Row[] = [];
    for (const [ccy, map] of byCcy) {
      const transfers = simplifyDebts(map);
      for (const t of transfers) {
        if (t.from !== me) continue;
        rows.push({
          key: `${ccy}-${t.to}`,
          creditorId: t.to,
          creditorName: profileById.get(t.to)?.full_name ?? "Unknown",
          currency: ccy,
          owed: t.amount,
          amount: t.amount.toString(),
          description: "",
          selected: true,
        });
      }
    }
    return rows;
  }, [balances, groupId, me, profileById]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch(`/groups/${groupId}`);
  }, [router, groupId]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing to settle"
        description="You have no outstanding debts in this group."
      />
    );
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function submit() {
    const items = rows
      .filter((r) => r.selected)
      .map((r) => ({
        creditor_id: r.creditorId,
        amount: r.amount,
        currency: r.currency,
        description: r.description.trim() || undefined,
      }));

    if (items.length === 0) {
      toast({ title: "Pick at least one creditor", variant: "destructive" });
      return;
    }
    for (const it of items) {
      if (!/^\d+$/.test(it.amount) || it.amount === "0") {
        toast({
          title: "Amounts must be positive whole numbers",
          variant: "destructive",
        });
        return;
      }
    }

    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      const result = await requestRepaymentsAction({
        group_id: groupId,
        items,
        idempotency_key: idempotencyKey,
      });
      if (!result.ok) {
        toast({
          title: "Couldn't send request",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Repayment requested",
        description: "Waiting for the lender to confirm.",
      });
      router.replace(`/groups/${groupId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settle up</h1>
          <p className="text-xs text-muted-foreground">
            Send a repayment request. The lender confirms.
          </p>
        </div>
      </header>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl border bg-card p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`row-${r.key}`}
                checked={r.selected}
                onCheckedChange={(v) => update(r.key, { selected: !!v })}
                className="mt-1"
                aria-label={`Pay ${r.creditorName}`}
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor={`amount-${r.key}`} className="font-medium">
                    {r.creditorName}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    owe {formatAmount(r.owed, r.currency)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-muted-foreground">
                    {symbolOf(r.currency)}
                  </span>
                  <Input
                    id={`amount-${r.key}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.amount}
                    onChange={(e) =>
                      update(r.key, {
                        amount: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="h-11 tabular-nums"
                    disabled={!r.selected}
                  />
                  <span className="text-sm text-muted-foreground">{r.currency}</span>
                </div>
                <Input
                  placeholder="Note (optional)"
                  maxLength={200}
                  value={r.description}
                  onChange={(e) =>
                    update(r.key, { description: e.target.value })
                  }
                  disabled={!r.selected}
                />
                {r.selected && /^\d+$/.test(r.amount) && BigInt(r.amount) > r.owed ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    More than what's owed — this will create a credit if accepted.
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={pending}
      >
        {pending ? "Sending…" : "Send request(s)"}
      </Button>
    </div>
  );
}
