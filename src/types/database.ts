// Public type surface for the rest of the app.
//
// `Database` and `Json` come straight from the auto-generated schema in
// database.generated.ts (regenerate with `npm run db:types`). The named row
// aliases below are convenience re-exports so existing imports like
// `import type { UserRow } from "@/types/database"` keep working.

import type { Database } from "./database.generated";

export type { Database, Json } from "./database.generated";

type Public = Database["public"];
type Tables = Public["Tables"];
type Views = Public["Views"];
type Enums = Public["Enums"];

export type UserRow = Tables["users"]["Row"];
export type GroupRow = Tables["groups"]["Row"];
export type GroupMemberRow = Tables["group_members"]["Row"];
export type InviteLinkRow = Tables["invite_links"]["Row"];
export type ExpenseRow = Tables["expenses"]["Row"];
export type ExpenseSplitRow = Tables["expense_splits"]["Row"];
export type RepaymentRow = Tables["repayments"]["Row"];
export type NotificationRow = Tables["notifications"]["Row"];

// Postgres views are typed as fully-nullable by the generator, but
// `group_balances` always projects non-null rows from real joined data, so we
// narrow it here. Consumers (netBalance.ts, /profile) treat these as required.
export type GroupBalanceRow = {
  group_id: string;
  user_id: string;
  currency: string;
  net_balance: number;
};

export type GroupRole = Enums["group_role"];
export type RepaymentStatus = Enums["repayment_status"];
export type NotificationType = Enums["notification_type"];
