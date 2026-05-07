"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Plus, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
}

const items: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    href: "/groups",
    label: "Groups",
    icon: Users,
    match: (p) => p.startsWith("/groups") && !p.startsWith("/groups/new"),
  },
  {
    href: "/groups/new",
    label: "New",
    icon: Plus,
    match: (p) => p.startsWith("/groups/new"),
  },
  {
    href: "/notifications",
    label: "Inbox",
    icon: Bell,
    match: (p) => p.startsWith("/notifications"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
    match: (p) => p.startsWith("/profile"),
  },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          const isPlus = it.href === "/groups/new";
          return (
            <li key={it.href} className="flex">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  it.href === "/notifications" && unread > 0
                    ? `Notifications, ${unread} unread`
                    : it.label
                }
                className={cn(
                  "flex flex-1 min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                  isPlus && "relative"
                )}
              >
                {isPlus ? (
                  <span className="-mt-7 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Icon className="h-6 w-6" />
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {it.href === "/notifications" && unread > 0 ? (
                      <span className="absolute -right-2 -top-1 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-[18px] text-destructive-foreground">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null}
                  </span>
                )}
                <span className={cn(isPlus && "sr-only")}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
