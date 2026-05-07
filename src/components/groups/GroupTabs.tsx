"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalancesTab } from "./BalancesTab";
import { ExpensesTab } from "./ExpensesTab";
import { HistoryTab } from "./HistoryTab";
import type {
  ExpenseRow,
  GroupBalanceRow,
  RepaymentRow,
  UserRow,
} from "@/types/database";

interface ExpenseWithSplit extends ExpenseRow {
  my_share?: number;
}

export function GroupTabs(props: {
  groupId: string;
  me: string;
  balances: GroupBalanceRow[];
  expenses: ExpenseWithSplit[];
  history: RepaymentRow[];
  profileMap: Array<[string, UserRow]>;
}) {
  const profileById = new Map(props.profileMap);

  return (
    <Tabs defaultValue="balances" className="w-full">
      <TabsList>
        <TabsTrigger value="balances">Balances</TabsTrigger>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="balances">
        <BalancesTab
          groupId={props.groupId}
          me={props.me}
          balances={props.balances}
          profileById={profileById}
        />
      </TabsContent>
      <TabsContent value="expenses">
        <ExpensesTab
          groupId={props.groupId}
          me={props.me}
          expenses={props.expenses}
          profileById={profileById}
        />
      </TabsContent>
      <TabsContent value="history">
        <HistoryTab
          me={props.me}
          history={props.history}
          profileById={profileById}
        />
      </TabsContent>
    </Tabs>
  );
}
