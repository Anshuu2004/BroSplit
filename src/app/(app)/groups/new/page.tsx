"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";
import { createGroupSchema, type CreateGroupInput } from "@/lib/validators";
import { useToast } from "@/hooks/useToast";
import { createGroupAction } from "@/server/groups";

export default function NewGroupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", primary_currency: "INR" },
  });

  async function onSubmit(values: CreateGroupInput) {
    setSubmitting(true);
    const result = await createGroupAction(values);
    if (!result.ok) {
      toast({
        title: "Couldn't create group",
        description: result.message,
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }
    router.replace(`/groups/${result.data.id}`);
    router.refresh();
  }

  const currency = watch("primary_currency");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New group</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a space to track shared expenses.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Group name</Label>
          <Input
            id="name"
            placeholder="Goa Trip"
            maxLength={50}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="primary_currency">Primary currency</Label>
          <Select
            value={currency}
            onValueChange={(v) => setValue("primary_currency", v)}
          >
            <SelectTrigger id="primary_currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Expenses in other currencies are still allowed and tracked separately.
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating…" : "Create group"}
        </Button>
      </form>
    </div>
  );
}
