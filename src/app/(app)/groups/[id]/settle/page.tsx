import { notFound } from "next/navigation";
import { SettleUpForm } from "@/components/repayments/SettleUpForm";
import { fetchGroupDetail } from "@/lib/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettleUpPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchGroupDetail(id);
  if (!detail) notFound();

  return (
    <SettleUpForm
      groupId={id}
      me={detail.me}
      balances={detail.balances}
      profileMap={Array.from(detail.profileById.entries())}
    />
  );
}
