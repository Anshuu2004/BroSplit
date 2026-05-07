// MVP: balances are tracked in integer "minor units" of each currency's display
// resolution. Per the PRD, INR is the default and amounts are whole rupees.
// We keep a tiny lookup table for symbols and the integer step (1 = whole units).

export interface CurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  /** Integer step, always 1 in MVP — amounts are whole units. */
  step: 1;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", step: 1 },
  { code: "USD", symbol: "$", name: "US Dollar", step: 1 },
  { code: "EUR", symbol: "€", name: "Euro", step: 1 },
  { code: "GBP", symbol: "£", name: "British Pound", step: 1 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", step: 1 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", step: 1 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", step: 1 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", step: 1 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", step: 1 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: string): CurrencyMeta {
  return BY_CODE.get(code) ?? { code, symbol: code, name: code, step: 1 };
}

export function symbolOf(code: string): string {
  return getCurrency(code).symbol;
}

/** Format an integer amount with the currency symbol and grouping. */
export function formatAmount(amount: bigint | number, code: string): string {
  const meta = getCurrency(code);
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(n);
  return `${meta.symbol}${formatted}`;
}

export function formatTotals(totals: Record<string, bigint>): string {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0n);
  if (entries.length === 0) return formatAmount(0n, "INR");
  return entries.map(([ccy, amt]) => formatAmount(amt, ccy)).join("  ");
}
