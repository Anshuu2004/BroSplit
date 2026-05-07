import { createClient, getCachedUser } from "@/lib/supabase/server";
import type {
  GroupBalanceRow,
  GroupRow,
  GroupMemberRow,
  UserRow,
} from "@/types/database";

/** Fetch all groups the current user is an active member of, plus member counts. */
export async function fetchUserGroups() {
  const user = await getCachedUser();
  if (!user) return { groups: [] as (GroupRow & { member_count: number })[] };
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .is("removed_at", null);

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) return { groups: [] };

  // Fetch groups + member counts in parallel.
  const [groupsRes, allMembersRes] = await Promise.all([
    supabase
      .from("groups")
      .select("*")
      .is("deleted_at", null)
      .in("id", groupIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds)
      .is("removed_at", null),
  ]);

  const counts = new Map<string, number>();
  (allMembersRes.data ?? []).forEach((m) => {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  });

  return {
    groups: (groupsRes.data ?? []).map((g) => ({
      ...(g as GroupRow),
      member_count: counts.get(g.id) ?? 0,
    })),
  };
}

/** Per-currency totals (lent / owed) for the current user across all their groups. */
export async function fetchUserBalances() {
  const user = await getCachedUser();
  if (!user) return { rows: [] as GroupBalanceRow[], userId: null as string | null };
  const supabase = await createClient();

  const { data } = await supabase
    .from("group_balances")
    .select("*")
    .eq("user_id", user.id);
  return { rows: (data ?? []) as GroupBalanceRow[], userId: user.id };
}

/**
 * Fetch everything a group detail page needs in as few round-trips as possible.
 * Group + members + balances run in parallel; profiles run after we have member ids.
 */
export async function fetchGroupDetail(groupId: string) {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();

  const [groupRes, membersRes, balancesRes] = await Promise.all([
    supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("group_id, user_id, role, joined_at, removed_at")
      .eq("group_id", groupId)
      .is("removed_at", null),
    supabase.from("group_balances").select("*").eq("group_id", groupId),
  ]);

  if (!groupRes.data) return null;

  const members = (membersRes.data ?? []) as GroupMemberRow[];
  const memberIds = members.map((m) => m.user_id);

  const profilesRes =
    memberIds.length > 0
      ? await supabase
          .from("users")
          .select(
            "id, email, full_name, avatar_url, default_currency, created_at, updated_at"
          )
          .in("id", memberIds)
      : { data: [] as UserRow[] };

  const profileById = new Map<string, UserRow>(
    (profilesRes.data ?? []).map((p) => [p.id as string, p as UserRow])
  );

  return {
    group: groupRes.data as GroupRow,
    members,
    profileById,
    balances: (balancesRes.data ?? []) as GroupBalanceRow[],
    me: user.id,
    isAdmin: members.find((m) => m.user_id === user.id)?.role === "admin",
  };
}
