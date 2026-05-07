import { describe, it, expect } from "vitest";
import {
  totalsLent,
  totalsOwed,
  balancesByCurrency,
} from "@/lib/algos/netBalance";
import type { GroupBalanceRow } from "@/types/database";

const me = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";

const rows: GroupBalanceRow[] = [
  { group_id: "g1", currency: "INR", user_id: me, net_balance: 2400 },
  { group_id: "g1", currency: "USD", user_id: me, net_balance: -50 },
  { group_id: "g2", currency: "EUR", user_id: me, net_balance: 30 },
  { group_id: "g1", currency: "INR", user_id: other, net_balance: -2400 },
];

describe("netBalance helpers", () => {
  it("computes per-currency totals you are owed", () => {
    const lent = totalsLent(rows, me);
    expect(lent).toEqual({ INR: 2400n, EUR: 30n });
  });

  it("computes per-currency totals you owe", () => {
    const owed = totalsOwed(rows, me);
    expect(owed).toEqual({ USD: 50n });
  });

  it("buckets balances by currency for a group", () => {
    const m = balancesByCurrency(rows, "g1");
    expect(m.size).toBe(2);
    expect(m.get("INR")?.get(me)).toBe(2400n);
    expect(m.get("INR")?.get(other)).toBe(-2400n);
    expect(m.get("USD")?.get(me)).toBe(-50n);
  });
});
