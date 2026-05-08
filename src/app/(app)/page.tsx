import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { fetchUserGroups, fetchUserBalances } from "@/lib/queries";
import { totalsLent, totalsOwed } from "@/lib/algos/netBalance";
import { formatTotals, symbolOf } from "@/lib/currency";

export default async function HomePage() {
  const [{ groups }, { rows, userId }] = await Promise.all([
    fetchUserGroups(),
    fetchUserBalances(),
  ]);

  const lent = userId ? totalsLent(rows, userId) : {};
  const owed = userId ? totalsOwed(rows, userId) : {};

  return (
    <div className="space-y-5">
      <section
        className="grid grid-cols-2 gap-3"
        aria-label="Your totals at a glance"
      >
        <Card className="bg-success/5 border-success/30">
          <CardContent className="p-4">
            <CardDescription>You are owed</CardDescription>
            <CardTitle className="mt-1 tabular-nums text-xl text-primary">
              {formatTotals(lent)}
            </CardTitle>
            <Link
              href="/profile"
              className="mt-2 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              See breakdown
            </Link>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/30">
          <CardContent className="p-4">
            <CardDescription>You owe</CardDescription>
            <CardTitle className="mt-1 tabular-nums text-xl text-destructive">
              {formatTotals(owed)}
            </CardTitle>
            <Link
              href="/profile"
              className="mt-2 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              See breakdown
            </Link>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Your groups" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your groups
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/groups/new">
              <Plus className="mr-1 h-4 w-4" /> New
            </Link>
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No groups yet"
            description="Create a group to start splitting expenses with friends."
            action={
              <Button asChild>
                <Link href="/groups/new">Create your first group</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{g.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.member_count} member{g.member_count === 1 ? "" : "s"}{" "}
                        · primary {symbolOf(g.primary_currency)}{" "}
                        {g.primary_currency}
                      </p>
                    </div>
                    <span aria-hidden className="text-muted-foreground">
                      ›
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
