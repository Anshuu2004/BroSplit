"use client";

import { useState, useTransition } from "react";
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
import { deleteExpenseAction } from "@/server/expenses";
import { useToast } from "@/hooks/useToast";

interface Props {
  expenseId: string;
  expenseName: string;
  canDelete: boolean;
}

export function DeleteExpenseButton({ expenseId, expenseName, canDelete }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canDelete) return null;

  function confirm() {
    startTransition(async () => {
      const result = await deleteExpenseAction({ expense_id: expenseId });
      if (!result.ok) {
        toast({
          title: "Couldn't delete expense",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Expense deleted" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Delete ${expenseName}`}
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>
              "{expenseName}" will be removed and balances will adjust for
              everyone in the split. This cannot be undone from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
