import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function generateInviteToken(): string {
  // 32-char URL-safe random.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  if (typeof btoa === "function") {
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(bytes).toString("base64url");
}

export function uuid(): string {
  return crypto.randomUUID();
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Convert a BigInt money amount to a Number for the JSON wire. Throws if the
 * value would lose precision. INR/USD amounts are nowhere near the limit, but
 * this keeps the integer-only-money invariant honest.
 */
export function safeAmountNumber(b: bigint, label = "amount"): number {
  if (b < 0n || b > MAX_SAFE) {
    throw new Error(`${label} is out of safe range`);
  }
  return Number(b);
}
