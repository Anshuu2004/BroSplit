import { Bell } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type {
  NotificationRow,
  RepaymentRow,
  UserRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: rawNotifs } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifs = (rawNotifs ?? []) as NotificationRow[];

  // Collect all referenced user ids for name resolution.
  const userIds = new Set<string>();
  const repaymentIds = new Set<string>();
  for (const n of notifs) {
    const p = (n.payload ?? {}) as Record<string, unknown>;
    for (const k of ["actor_id", "debtor_id", "creditor_id"]) {
      const v = p[k];
      if (typeof v === "string") userIds.add(v);
    }
    const rid = p["repayment_id"];
    if (typeof rid === "string") repaymentIds.add(rid);
  }

  // Parallel: users (for names) + repayments (for pending status checks).
  const [usersRes, repaymentsRes] = await Promise.all([
    userIds.size > 0
      ? supabase
          .from("users")
          .select("id, email, full_name, avatar_url, default_currency, created_at, updated_at")
          .in("id", Array.from(userIds))
      : Promise.resolve({ data: [] as UserRow[] }),
    repaymentIds.size > 0
      ? supabase
          .from("repayments")
          .select("*")
          .in("id", Array.from(repaymentIds))
      : Promise.resolve({ data: [] as RepaymentRow[] }),
  ]);
  const users = usersRes.data;
  const repayments = repaymentsRes.data;

  const profileMap: Array<[string, UserRow]> = (users ?? []).map((u) => [
    u.id as string,
    u as UserRow,
  ]);
  const repaymentById = new Map<string, RepaymentRow>(
    (repayments ?? []).map((r) => [r.id as string, r as RepaymentRow])
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        {notifs.some((n) => !n.read_at) ? <MarkAllReadButton /> : null}
      </header>

      {notifs.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No notifications yet"
          description="Group activity will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {notifs.map((n) => {
            const p = (n.payload ?? {}) as { repayment_id?: string };
            const r = p.repayment_id ? repaymentById.get(p.repayment_id) : null;
            return (
              <NotificationItem
                key={n.id}
                notif={n}
                profileMap={profileMap}
                pendingRepayment={r ?? null}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
