"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, formatAmount, symbolOf } from "@/lib/currency";
import { splitEqual } from "@/lib/algos/splitEqual";
import { createExpenseAction } from "@/server/expenses";
import { useToast } from "@/hooks/useToast";
import { initials } from "@/lib/utils";

interface MemberLite {
  id: string;
  full_name: string;
}

interface Props {
  groupId: string;
  primaryCurrency: string;
  me: string;
  members: MemberLite[];
}

export function AddExpenseForm({ groupId, primaryCurrency, me, members }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(primaryCurrency);
  const [paidBy, setPaidBy] = useState(me);
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(members.map((m) => m.id))
  );
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    router.prefetch(`/groups/${groupId}`);
  }, [router, groupId]);

  const amountOk = /^\d+$/.test(amount) && Number(amount) > 0;
  const nameOk = name.trim().length > 0 && name.trim().length <= 100;

  const splits = useMemo(() => {
    if (!amountOk || participants.size === 0) return [];
    try {
      return splitEqual(BigInt(amount), Array.from(participants));
    } catch {
      return [];
    }
  }, [amount, amountOk, participants]);

  const splitByUser = useMemo(() => {
    const m = new Map<string, bigint>();
    for (const s of splits) m.set(s.user_id, s.share);
    return m;
  }, [splits]);

  function toggle(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function next() {
    const e: Record<string, string> = {};
    if (!nameOk) e.name = "Enter a name (1–100 chars)";
    if (!amountOk) e.amount = "Enter a positive whole number";
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  }

  function submit() {
    if (participants.size === 0) {
      toast({
        title: "Pick at least one participant",
        variant: "destructive",
      });
      return;
    }
    // Navigate first so the user lands back on the group page immediately;
    // the server action runs in the background and the realtime subscription
    // (or revalidatePath) reconciles the new expense into the list.
    router.replace(`/groups/${groupId}`);
    toast({ title: "Adding expense…" });
    startTransition(async () => {
      const result = await createExpenseAction({
        group_id: groupId,
        name: name.trim(),
        amount,
        currency,
        paid_by: paidBy,
        participants: Array.from(participants),
      });
      if (!result.ok) {
        toast({
          title: "Couldn't add expense",
          description: result.message,
          variant: "destructive",
        });
      }
    });
  }

  if (step === 1) {
    return (
      <div className="space-y-5">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Cancel">
            <Link href={`/groups/${groupId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Add expense</h1>
            <p className="text-xs text-muted-foreground">Step 1 of 2 · the basics</p>
          </div>
        </header>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-base">
              Amount
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-muted-foreground">
                {symbolOf(currency)}
              </span>
              <Input
                id="amount"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-3xl font-semibold tabular-nums"
                aria-invalid={!!errors.amount}
              />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-14 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errors.amount ? (
              <p className="text-xs text-destructive">{errors.amount}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Whole numbers only. The math will always be exact.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">What was it for?</Label>
            <Input
              id="name"
              placeholder="Dinner, groceries, taxi…"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paid_by">Paid by</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger id="paid_by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id === me ? "You" : m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="lg" className="w-full" onClick={next}>
          Next
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => setStep(1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Split with</h1>
          <p className="text-xs text-muted-foreground">
            Step 2 of 2 · {participants.size} of {members.length} selected
          </p>
        </div>
      </header>

      <div className="rounded-md border bg-card p-3 text-sm">
        <span className="text-muted-foreground">Total</span>{" "}
        <span className="font-semibold tabular-nums">
          {amountOk ? formatAmount(BigInt(amount), currency) : "—"}
        </span>{" "}
        <span className="text-muted-foreground">·</span>{" "}
        <span className="text-muted-foreground">
          {participants.size > 0
            ? `≈ ${formatAmount(BigInt(amount) / BigInt(participants.size), currency)} each`
            : "no one selected"}
        </span>
      </div>

      <ul className="divide-y rounded-md border bg-card">
        {members.map((m) => {
          const checked = participants.has(m.id);
          const share = splitByUser.get(m.id);
          return (
            <li key={m.id} className="flex items-center gap-3 p-3">
              <Checkbox
                id={`p-${m.id}`}
                checked={checked}
                onCheckedChange={() => toggle(m.id)}
                aria-label={m.full_name}
              />
              <Label
                htmlFor={`p-${m.id}`}
                className="flex flex-1 cursor-pointer items-center gap-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {initials(m.full_name)}
                </span>
                <span className="flex-1 text-sm">
                  {m.id === me ? "You" : m.full_name}
                </span>
              </Label>
              <span className="text-sm font-semibold tabular-nums">
                {checked && share !== undefined
                  ? formatAmount(share, currency)
                  : "—"}
              </span>
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={pending || participants.size === 0}
      >
        {pending ? "Splitting…" : "Split"}
      </Button>
    </div>
  );
}
