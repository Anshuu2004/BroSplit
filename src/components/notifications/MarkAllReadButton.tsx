"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/server/notifications";

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await markAllNotificationsReadAction();
        setBusy(false);
        router.refresh();
      }}
    >
      Mark all read
    </Button>
  );
}
