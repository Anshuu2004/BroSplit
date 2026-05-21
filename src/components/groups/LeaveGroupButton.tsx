"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { leaveGroupAction } from "@/server/groups";
import { useToast } from "@/hooks/useToast";

export function LeaveGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      const result = await leaveGroupAction(groupId);
      if (!result.ok) {
        toast({
          title: "Couldn't leave",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "You left the group" });
      setOpen(false);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LogOut className="mr-2 h-4 w-4" /> Leave group
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {groupName}?</DialogTitle>
            <DialogDescription>
              You'll stop seeing this group and any pending repayments involving
              you will be cancelled. Past expenses you were part of stay in the
              group's history. An admin can re-invite you later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={leave} disabled={pending}>
              {pending ? "Leaving…" : "Leave group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
