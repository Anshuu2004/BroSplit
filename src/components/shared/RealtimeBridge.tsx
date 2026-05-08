"use client";

import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";

export function RealtimeBridge({ userId }: { userId: string }) {
  useNotificationsRealtime(userId);
  return null;
}
