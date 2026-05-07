import { describe, it, expect } from "vitest";
import { splitEqual, verifySplit } from "@/lib/algos/splitEqual";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const D = "44444444-4444-4444-4444-444444444444";

describe("splitEqual", () => {
  it("splits an exactly divisible amount", () => {
    const r = splitEqual(90n, [A, B, C]);
    expect(r.map((s) => Number(s.share))).toEqual([30, 30, 30]);
    expect(r.every((s) => !s.is_remainder_payer)).toBe(true);
    expect(verifySplit(90n, r)).toBe(true);
  });

  it("distributes a 1-unit remainder deterministically to the smallest UUID", () => {
    const r = splitEqual(100n, [C, A, B]);
    // sorted ascending: A, B, C → A gets the +1
    expect(r.map((s) => s.user_id)).toEqual([A, B, C]);
    expect(r.map((s) => Number(s.share))).toEqual([34, 33, 33]);
    expect(r[0].is_remainder_payer).toBe(true);
    expect(r[1].is_remainder_payer).toBe(false);
    expect(verifySplit(100n, r)).toBe(true);
  });

  it("distributes a multi-unit remainder", () => {
    // 7 / 4 = 1 remainder 3 → first 3 sorted get +1
    const r = splitEqual(7n, [D, B, A, C]);
    expect(r.map((s) => s.user_id)).toEqual([A, B, C, D]);
    expect(r.map((s) => Number(s.share))).toEqual([2, 2, 2, 1]);
    expect(verifySplit(7n, r)).toBe(true);
  });

  it("handles tiny amounts where some get zero", () => {
    const r = splitEqual(1n, [A, B, C]);
    expect(r.map((s) => Number(s.share))).toEqual([1, 0, 0]);
    expect(verifySplit(1n, r)).toBe(true);
  });

  it("handles a single participant", () => {
    const r = splitEqual(42n, [A]);
    expect(r).toEqual([{ user_id: A, share: 42n, is_remainder_payer: false }]);
  });

  it("rejects non-positive amounts", () => {
    expect(() => splitEqual(0n, [A])).toThrow();
    expect(() => splitEqual(-1n, [A])).toThrow();
  });

  it("rejects empty participant list", () => {
    expect(() => splitEqual(10n, [])).toThrow();
  });

  it("is deterministic across reruns", () => {
    const r1 = splitEqual(1234n, [C, A, B]);
    const r2 = splitEqual(1234n, [B, A, C]);
    expect(r1).toEqual(r2);
  });
});
