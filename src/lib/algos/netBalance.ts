import type { GroupBalanceRow } from "@/types/database";

export type CurrencyTotals = Record<string, bigint>;

/** Total amount the user is owed (positive balances) per currency. */
export function totalsLent(rows: GroupBalanceRow[], userId: string): CurrencyTotals {
  const out: CurrencyTotals = {};
  for (const r of rows) {
    if (r.user_id !== userId) continue;
    const v = BigInt(r.net_balance);
    if (v > 0n) out[r.currency] = (out[r.currency] ?? 0n) + v;
  }
  return out;
}

/** Total amount the user owes (negative balances flipped to positive) per currency. */
export function totalsOwed(rows: GroupBalanceRow[], userId: string): CurrencyTotals {
  const out: CurrencyTotals = {};
  for (const r of rows) {
    if (r.user_id !== userId) continue;
    const v = BigInt(r.net_balance);
    if (v < 0n) out[r.currency] = (out[r.currency] ?? 0n) + -v;
  }
  return out;
}

/**
 * Build a per-currency map of `userId -> netBalance` for one group.
 * Feed this into simplifyDebts.
 */
export function balancesByCurrency(
  rows: GroupBalanceRow[],
  groupId: string
): Map<string, Map<string, bigint>> {
  const byCcy = new Map<string, Map<string, bigint>>();
  for (const r of rows) {
    if (r.group_id !== groupId) continue;
    if (!byCcy.has(r.currency)) byCcy.set(r.currency, new Map());
    byCcy.get(r.currency)!.set(r.user_id, BigInt(r.net_balance));
  }
  return byCcy;
}
