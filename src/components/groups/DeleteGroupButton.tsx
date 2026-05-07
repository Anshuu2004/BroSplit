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
import { deleteGroupAction } from "@/server/groups";
import { useToast } from "@/hooks/useToast";

export function DeleteGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function del() {
    setLoading(true);
    const result = await deleteGroupAction(groupId);
    if (!result.ok) {
      toast({
        title: "Couldn't delete group",
        description: result.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    toast({ title: "Group deleted" });
    setOpen(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" /> Delete group
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription>
              All expenses, splits, and pending repayments will be archived. This
              cannot be undone from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={del} disabled={loading}>
              {loading ? "Deleting…" : "Delete group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
