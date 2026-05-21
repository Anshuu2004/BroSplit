import { LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { totalsLent, totalsOwed } from "@/lib/algos/netBalance";
import { formatAmount, formatTotals } from "@/lib/currency";
import { initials } from "@/lib/utils";
import type { GroupBalanceRow } from "@/types/database";

export default async function ProfilePage() {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();

  // Three independent reads in parallel:
  //   - profile (name, email)
  //   - just my own balance rows for the top-line totals (RLS narrows further to my groups)
  //   - the drill-down (simplified open positions involving me) via RPC, so the
  //     greedy debt-simplification runs in Postgres, not the request thread.
  const [profileRes, myBalancesRes, positionsRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, email, full_name, avatar_url, default_currency, created_at, updated_at"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("group_balances").select("*").eq("user_id", user.id),
    supabase.rpc("get_user_open_positions"),
  ]);

  const profile = profileRes.data;
  const myRows = (myBalancesRes.data ?? []) as GroupBalanceRow[];
  const lent = totalsLent(myRows, user.id);
  const owed = totalsOwed(myRows, user.id);

  const positions = (positionsRes.data ?? []) as {
    group_id: string;
    group_name: string;
    currency: string;
    role: "lent" | "owed";
    counterparty: string;
    counter_name: string;
    amount: number;
  }[];

  const lentRows = positions.filter((p) => p.role === "lent");
  const owedRows = positions.filter((p) => p.role === "owed");

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
                key={`${idx}-${d.counterparty}-${d.group_id}-${d.currency}`}
                className="flex items-center justify-between rounded-xl border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {d.counter_name ?? "Unknown"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.group_name}
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
                key={`${idx}-${d.counterparty}-${d.group_id}-${d.currency}`}
                className="flex items-center justify-between rounded-xl border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {d.counter_name ?? "Unknown"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.group_name}
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
