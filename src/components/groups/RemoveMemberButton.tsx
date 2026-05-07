"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMemberBalanceSummaryAction,
  removeMemberAction,
} from "@/server/groups";
import { formatAmount } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";

interface BalanceRow {
  currency: string;
  net_balance: number;
}

export function RemoveMemberButton({
  groupId,
  userId,
  userName,
}: {
  groupId: string;
  userId: string;
  userName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<BalanceRow[]>([]);

  async function check() {
    setLoading(true);
    const result = await getMemberBalanceSummaryAction(groupId, userId);
    if (!result.ok) {
      toast({
        title: "Couldn't check balances",
        description: result.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setBalances(result.data);
    setLoading(false);
    setOpen(true);
  }

  async function remove() {
    setLoading(true);
    const result = await removeMemberAction(groupId, userId);
    if (!result.ok) {
      toast({
        title: "Couldn't remove member",
        description: result.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    toast({ title: "Member removed" });
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  const hasBalance = balances.length > 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={check}
        disabled={loading}
        aria-label={`Remove ${userName}`}
      >
        <Trash2 className="mr-1 h-4 w-4" /> Remove
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {userName}?</DialogTitle>
            <DialogDescription>
              {hasBalance
                ? `${userName} has open balances in this group. Removing them will cancel pending repayments and freeze their existing splits.`
                : "They have no outstanding balance in this group."}
            </DialogDescription>
          </DialogHeader>

          {hasBalance ? (
            <ul className="space-y-1 rounded-md border bg-secondary/40 p-3 text-sm">
              {balances.map((b) => {
                const owes = b.net_balance < 0;
                return (
                  <li key={b.currency} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{b.currency}</span>
                    <span
                      className={
                        owes
                          ? "font-semibold text-destructive tabular-nums"
                          : "font-semibold text-primary tabular-nums"
                      }
                    >
                      {owes ? "owes " : "is owed "}
                      {formatAmount(Math.abs(b.net_balance), b.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={loading}>
              {loading ? "Removing…" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
