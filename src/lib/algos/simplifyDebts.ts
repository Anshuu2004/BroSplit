export interface Transfer {
  from: string;
  to: string;
  amount: bigint;
}

/**
 * Greedy max-creditor / max-debtor debt simplification per currency.
 * Optimal min-transactions is NP-hard; this matches Splitwise's behaviour
 * and produces ≤ N − 1 transfers.
 */
export function simplifyDebts(balances: Map<string, bigint>): Transfer[] {
  const debtors: { id: string; amt: bigint }[] = [];
  const creditors: { id: string; amt: bigint }[] = [];

  for (const [id, bal] of balances) {
    if (bal > 0n) creditors.push({ id, amt: bal });
    else if (bal < 0n) debtors.push({ id, amt: -bal });
  }

  const transfers: Transfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => (b.amt > a.amt ? 1 : b.amt < a.amt ? -1 : 0));
    creditors.sort((a, b) => (b.amt > a.amt ? 1 : b.amt < a.amt ? -1 : 0));

    const d = debtors[0];
    const c = creditors[0];
    const x = d.amt < c.amt ? d.amt : c.amt;

    transfers.push({ from: d.id, to: c.id, amount: x });

    d.amt -= x;
    c.amt -= x;
    if (d.amt === 0n) debtors.shift();
    if (c.amt === 0n) creditors.shift();
  }

  return transfers;
}
