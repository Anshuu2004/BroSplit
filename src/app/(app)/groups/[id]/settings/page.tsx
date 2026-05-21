import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchGroupDetail } from "@/lib/queries";
import { RemoveMemberButton } from "@/components/groups/RemoveMemberButton";
import { DeleteGroupButton } from "@/components/groups/DeleteGroupButton";
import { LeaveGroupButton } from "@/components/groups/LeaveGroupButton";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchGroupDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to group">
          <Link href={`/groups/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {detail.group.name}
          </h1>
          <p className="text-xs text-muted-foreground">Group settings</p>
        </div>
      </header>

      <section aria-label="Members">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members
        </h2>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {detail.members.map((m) => {
                const u = detail.profileById.get(m.user_id);
                const isMe = m.user_id === detail.me;
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                        {initials(u?.full_name ?? "?")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {u?.full_name ?? "Unknown"}
                          {isMe ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (you)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {u?.email ?? "—"}
                          {m.role === "admin" ? " · admin" : ""}
                        </p>
                      </div>
                    </div>
                    {detail.isAdmin && !isMe ? (
                      <RemoveMemberButton
                        groupId={id}
                        userId={m.user_id}
                        userName={u?.full_name ?? "this member"}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Membership" className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your membership
        </h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Leaving this group cancels any pending repayments involving you.
              {detail.isAdmin
                ? " As the admin, you can only leave if another admin remains."
                : ""}
            </p>
            <LeaveGroupButton groupId={id} groupName={detail.group.name} />
          </CardContent>
        </Card>
      </section>

      {detail.isAdmin ? (
        <section aria-label="Danger zone" className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-destructive">
            Danger zone
          </h2>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Deleting this group archives every expense, split, and pending
                repayment. Member accounts are not affected.
              </p>
              <DeleteGroupButton groupId={id} />
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
