"use client";

import { useState } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateInviteAction } from "@/server/groups";
import { useToast } from "@/hooks/useToast";

export function InviteButton({ groupId }: { groupId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setLink(null);
    const result = await generateInviteAction(groupId);
    if (!result.ok) {
      toast({
        title: "Couldn't generate invite",
        description: result.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${origin}/join/${result.data.token}`);
    setExpiresAt(result.data.expires_at);
    setLoading(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copied" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="mr-2 h-4 w-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to group</DialogTitle>
          <DialogDescription>
            Generate a link valid for 7 days. Anyone with the link can join.
          </DialogDescription>
        </DialogHeader>
        {!link ? (
          <Button onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "Generate invite link"}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-md border bg-secondary px-3 py-2 text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button onClick={copy} size="icon" variant="outline" aria-label="Copy">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {expiresAt ? (
              <p className="text-xs text-muted-foreground">
                Expires {new Date(expiresAt).toLocaleString()}
              </p>
            ) : null}
            <Button variant="outline" onClick={generate} disabled={loading}>
              Generate another
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
