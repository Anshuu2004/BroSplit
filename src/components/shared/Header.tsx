import Link from "next/link";
import { Bell } from "lucide-react";

export function Header({ unread = 0 }: { unread?: number }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
        <span className="inline-block h-6 w-6 rounded-md bg-primary" aria-hidden />
        Brosplit
      </Link>
      <Link
        href="/notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-[18px] text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </header>
  );
}
