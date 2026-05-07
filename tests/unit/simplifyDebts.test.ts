import { describe, it, expect } from "vitest";
import { simplifyDebts } from "@/lib/algos/simplifyDebts";

describe("simplifyDebts", () => {
  it("returns an empty list for an all-zero balance map", () => {
    const r = simplifyDebts(new Map([["a", 0n], ["b", 0n]]));
    expect(r).toEqual([]);
  });

  it("matches one creditor with one debtor", () => {
    const r = simplifyDebts(new Map([["a", 20n], ["b", -20n]]));
    expect(r).toEqual([{ from: "b", to: "a", amount: 20n }]);
  });

  it("collapses a chain a→b→c into a→c", () => {
    const r = simplifyDebts(new Map([["a", -20n], ["b", 0n], ["c", 20n]]));
    expect(r).toEqual([{ from: "a", to: "c", amount: 20n }]);
  });

  it("settles N debtors against M creditors with sum(debt)=sum(credit)", () => {
    const r = simplifyDebts(
      new Map<string, bigint>([
        ["a", -50n],
        ["b", -30n],
        ["c", 60n],
        ["d", 20n],
      ])
    );
    const total = r.reduce((s, t) => s + t.amount, 0n);
    expect(total).toBe(80n);
    // Should be ≤ N − 1 transfers.
    expect(r.length).toBeLessThanOrEqual(3);
    // Every transfer non-zero.
    expect(r.every((t) => t.amount > 0n)).toBe(true);
  });

  it("ignores users with zero balance", () => {
    const r = simplifyDebts(
      new Map<string, bigint>([
        ["a", 0n],
        ["b", -10n],
        ["c", 10n],
      ])
    );
    expect(r.find((t) => t.from === "a" || t.to === "a")).toBeUndefined();
  });
});
