import { LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { totalsLent, totalsOwed } from "@/lib/algos/netBalance";
import { formatAmount, formatTotals } from "@/lib/currency";
import { initials } from "@/lib/utils";
import type { GroupBalanceRow, GroupRow, UserRow } from "@/types/database";
import { simplifyDebts } from "@/lib/algos/simplifyDebts";
import { balancesByCurrency } from "@/lib/algos/netBalance";

export default async function ProfilePage() {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();

  // Parallel: profile + ALL balances of every group I'm in.
  // We only need one pass over group_balances — RLS limits rows to my groups.
  const [profileRes, balancesRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, email, full_name, avatar_url, default_currency, created_at, updated_at"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("group_balances").select("*"),
  ]);

  const profile = profileRes.data;
  const allRows = (balancesRes.data ?? []) as GroupBalanceRow[];

  // My own per-currency totals — derived from rows where user_id === me.
  const myRows = allRows.filter((r) => r.user_id === user.id);
  const lent = totalsLent(myRows, user.id);
  const owed = totalsOwed(myRows, user.id);

  const groupIds = Array.from(new Set(myRows.map((r) => r.group_id)));

  const groupsRes =
    groupIds.length > 0
      ? await supabase.from("groups").select("id, name").in("id", groupIds)
      : { data: [] as Pick<GroupRow, "id" | "name">[] };

  const groupNameById = new Map<string, string>(
    (groupsRes.data ?? []).map((g) => [g.id as string, g.name as string])
  );

  // Build drill-down: simplify per group/currency, keep transfers involving me.
  const counterIds = new Set<string>();
  const drilldown: {
    role: "lent" | "owed";
    counterparty: string;
    groupId: string;
    currency: string;
    amount: bigint;
  }[] = [];

  for (const groupId of groupIds) {
    const byCcy = balancesByCurrency(allRows, groupId);
    for (const [ccy, map] of byCcy) {
      const transfers = simplifyDebts(map);
      for (const t of transfers) {
        if (t.from === user.id) {
          counterIds.add(t.to);
          drilldown.push({
            role: "owed",
            counterparty: t.to,
            groupId,
            currency: ccy,
            amount: t.amount,
          });
        } else if (t.to === user.id) {
          counterIds.add(t.from);
          drilldown.push({
            role: "lent",
            counterparty: t.from,
            groupId,
            currency: ccy,
            amount: t.amount,
          });
        }
      }
    }
  }

  const counterUsersRes =
    counterIds.size > 0
      ? await supabase
          .from("users")
          .select("id, full_name")
          .in("id", Array.from(counterIds))
      : { data: [] as Pick<UserRow, "id" | "full_name">[] };

  const counterNameById = new Map<string, string>(
    (counterUsersRes.data ?? []).map((u) => [
      u.id as string,
      u.full_name as string,
    ])
  );

  const lentRows = drilldown.filter((d) => d.role === "lent");
  const owedRows = drilldown.filter((d) => d.role === "owed");

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary">
          {initials(profile?.full_name ?? "?")}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {profile?.full_name ?? "—"}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {profile?.email ?? user.email}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Card className="bg-success/5 border-success/30">
          <CardContent className="p-4">
            <CardDescription>You are owed</CardDescription>
            <CardTitle className="mt-1 tabular-nums text-xl text-primary">
              {formatTotals(lent)}
            </CardTitle>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/30">
          <CardContent className="p-4">
            <CardDescription>You owe</CardDescription>
            <CardTitle className="mt-1 tabular-nums text-xl text-destructive">
              {formatTotals(owed)}
            </CardTitle>
          </CardContent>
        </Card>
      </section>

      {lentRows.length > 0 ? (
        <section aria-label="Open lent positions">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Owed to you
          </h2>
          <ul className="space-y-2">
            {lentRows.map((d, idx) => (
              <li
                key={`${idx}-${d.counterparty}-${d.groupId}-${d.currency}`}
                className="flex items-center justify-between rounded-xl border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {counterNameById.get(d.counterparty) ?? "Unknown"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {groupNameById.get(d.groupId) ?? "Group"}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-primary">
                  {formatAmount(d.amount, d.currency)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {owedRows.length > 0 ? (
        <section aria-label="Open owed positions">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            You owe
          </h2>
          <ul className="space-y-2">
            {owedRows.map((d, idx) => (
              <li
                key={`${idx}-${d.counterparty}-${d.groupId}-${d.currency}`}
                className="flex items-center justify-between rounded-xl border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {counterNameById.get(d.counterparty) ?? "Unknown"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {groupNameById.get(d.groupId) ?? "Group"}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-destructive">
                  {formatAmount(d.amount, d.currency)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </form>
    </div>
  );
}
