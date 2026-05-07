export interface Split {
  user_id: string;
  share: bigint;
  is_remainder_payer: boolean;
}

/**
 * Split an integer amount equally among N participants. Remainder is distributed
 * one unit at a time to the first R participants in ascending UUID order, so the
 * result is deterministic across re-runs and matches the server-side RPC.
 */
export function splitEqual(amount: bigint, participants: string[]): Split[] {
  if (amount <= 0n) throw new Error("amount must be a positive integer");
  if (participants.length === 0) throw new Error("need at least one participant");

  const n = BigInt(participants.length);
  const base = amount / n;
  const rem = Number(amount - base * n);

  const sorted = [...participants].sort();

  return sorted.map((uid, i) => ({
    user_id: uid,
    share: base + (i < rem ? 1n : 0n),
    is_remainder_payer: i < rem,
  }));
}

/** Sanity check: SUM(share) === amount. */
export function verifySplit(amount: bigint, splits: Split[]): boolean {
  return splits.reduce((acc, s) => acc + s.share, 0n) === amount;
}
