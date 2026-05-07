"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptRepaymentAction,
  rejectRepaymentAction,
} from "@/server/repayments";
import { markNotificationReadAction } from "@/server/notifications";
import { useToast } from "@/hooks/useToast";
import { formatAmount } from "@/lib/currency";
import { relativeTime } from "@/lib/utils";
import type {
  NotificationRow,
  NotificationType,
  RepaymentRow,
  UserRow,
} from "@/types/database";

function payload<T = Record<string, unknown>>(n: NotificationRow): T {
  return (n.payload ?? {}) as T;
}

function description(n: NotificationRow, profileById: Map<string, UserRow>): string {
  const p = payload<{
    actor_id?: string;
    debtor_id?: string;
    creditor_id?: string;
    name?: string;
    amount?: number;
    currency?: string;
  }>(n);
  const actor = profileById.get(p.actor_id ?? "")?.full_name;
  const debtor = profileById.get(p.debtor_id ?? "")?.full_name;
  const creditor = profileById.get(p.creditor_id ?? "")?.full_name;
  switch (n.type as NotificationType) {
    case "EXPENSE_ADDED":
      return `${actor ?? "Someone"} added "${p.name}" for ${formatAmount(p.amount ?? 0, p.currency ?? "INR")}`;
    case "EXPENSE_DELETED":
      return `${actor ?? "Someone"} deleted "${p.name}"`;
    case "EXPENSE_EDITED":
      return `${actor ?? "Someone"} edited "${p.name}"`;
    case "REPAYMENT_REQUEST":
      return `${debtor ?? "Someone"} requested to pay you ${formatAmount(p.amount ?? 0, p.currency ?? "INR")}`;
    case "REPAYMENT_ACCEPTED":
      return `${creditor ?? "Someone"} confirmed your repayment of ${formatAmount(p.amount ?? 0, p.currency ?? "INR")}`;
    case "REPAYMENT_REJECTED":
      return `${creditor ?? "Someone"} rejected your repayment request`;
    case "MEMBER_JOINED":
      return `${actor ?? "Someone"} joined the group`;
    case "MEMBER_REMOVED":
      return `${actor ?? "Someone"} was removed from the group`;
    case "GROUP_JOINED":
      return "You joined a group";
    case "GROUP_REMOVED":
      return "You were removed from a group";
    case "GROUP_INVITE":
      return "You received a group invite";
    default:
      return n.type;
  }
}

interface Props {
  notif: NotificationRow;
  profileMap: Array<[string, UserRow]>;
  pendingRepayment?: RepaymentRow | null;
}

export function NotificationItem({ notif, profileMap, pendingRepayment }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const profileById = new Map(profileMap);
  const [busy, setBusy] = useState(false);

  const p = payload<{ group_id?: string; repayment_id?: string }>(notif);
  const target = p.group_id ? `/groups/${p.group_id}` : "/";

  async function markRead() {
    if (notif.read_at) return;
    await markNotificationReadAction(notif.id);
    router.refresh();
  }

  async function accept() {
    if (!p.repayment_id) return;
    setBusy(true);
    const result = await acceptRepaymentAction(p.repayment_id);
    if (!result.ok) {
      toast({
        title: "Couldn't accept",
        description: result.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Accepted" });
      await markNotificationReadAction(notif.id);
    }
    setBusy(false);
    router.refresh();
  }

  async function reject() {
    if (!p.repayment_id) return;
    setBusy(true);
    const result = await rejectRepaymentAction(p.repayment_id);
    if (!result.ok) {
      toast({
        title: "Couldn't reject",
        description: result.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Rejected" });
      await markNotificationReadAction(notif.id);
    }
    setBusy(false);
    router.refresh();
  }

  const showActions =
    notif.type === "REPAYMENT_REQUEST" &&
    pendingRepayment &&
    pendingRepayment.status === "PENDING";

  return (
    <li
      className={
        "rounded-xl border bg-card p-3 " +
        (notif.read_at ? "" : "border-l-4 border-l-accent")
      }
    >
      <Link href={target} onClick={markRead} className="block">
        <p className="text-sm">{description(notif, profileById)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relativeTime(notif.created_at)}
        </p>
      </Link>

      {showActions ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={accept} disabled={busy}>
            <Check className="mr-1 h-4 w-4" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={reject} disabled={busy}>
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
        </div>
      ) : null}
    </li>
  );
}
