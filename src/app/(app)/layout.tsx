import { redirect } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { BottomNav } from "@/components/shared/BottomNav";
import { RealtimeBridge } from "@/components/shared/RealtimeBridge";
import { createClient, getCachedUser } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Run unread count in parallel with rendering children — but we still need
  // the count synchronously for the header/nav badge. Single round-trip.
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <RealtimeBridge userId={user.id} />
      <Header unread={unread ?? 0} />
      <main className="flex-1 px-4 pb-28 pt-3">{children}</main>
      <BottomNav unread={unread ?? 0} />
    </div>
  );
}
