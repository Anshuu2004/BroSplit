import { notFound } from "next/navigation";
import { AddExpenseForm } from "@/components/expenses/AddExpenseForm";
import { fetchGroupDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewExpensePage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchGroupDetail(id);
  if (!detail) notFound();

  const members = detail.members.map((m) => ({
    id: m.user_id,
    full_name: detail.profileById.get(m.user_id)?.full_name ?? "Unknown",
  }));

  return (
    <AddExpenseForm
      groupId={id}
      primaryCurrency={detail.group.primary_currency}
      me={detail.me}
      members={members}
    />
  );
}
