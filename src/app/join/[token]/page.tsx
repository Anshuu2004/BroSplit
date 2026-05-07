import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCachedUser } from "@/lib/supabase/server";
import { joinByTokenAction } from "@/server/groups";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: PageProps) {
  const { token } = await params;
  const user = await getCachedUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  const result = await joinByTokenAction(token);
  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 text-center">
        <h1 className="text-xl font-semibold">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
        <Button asChild className="mt-6">
          <Link href="/">Go home</Link>
        </Button>
      </main>
    );
  }

  redirect(`/groups/${result.data.group_id}`);
}
