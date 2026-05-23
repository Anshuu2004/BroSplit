"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { createClient } from "@/lib/supabase/client";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

type LoginErrorKind = "unconfirmed" | "rate_limited" | "invalid" | "other";

type LoginError = {
  kind: LoginErrorKind;
  message: string;
};

function mapLoginError(error: { code?: string; message?: string }): LoginError {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
    return {
      kind: "unconfirmed",
      message:
        "Your email isn't confirmed yet. Check your inbox (and spam) for the confirmation link.",
    };
  }
  if (code === "invalid_credentials" || msg.includes("invalid login")) {
    return { kind: "invalid", message: "Invalid email or password." };
  }
  if (code === "over_request_rate_limit" || msg.includes("rate limit")) {
    return {
      kind: "rate_limited",
      message: "Too many attempts. Wait a minute and try again.",
    };
  }
  return {
    kind: "other",
    message: error.message ?? "Something went wrong. Please try again.",
  };
}

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<LoginError | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle"
  );

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    setServerError(null);
    setResendState("idle");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setServerError(mapLoginError(error));
      setSubmitting(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function handleResend() {
    const email = getValues("email");
    if (!email) return;
    setResendState("sending");
    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    if (error) {
      setServerError(mapLoginError(error));
      setResendState("idle");
      return;
    }
    setResendState("sent");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to keep your group balances up to date.
        </p>
      </div>

      <OAuthButtons />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        {serverError ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{serverError.message}</p>
            {serverError.kind === "unconfirmed" ? (
              resendState === "sent" ? (
                <p className="text-xs text-muted-foreground">
                  Sent! Check your inbox.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === "sending" || !getValues("email")}
                  className="text-xs font-medium underline underline-offset-2 hover:no-underline disabled:opacity-60"
                >
                  {resendState === "sending"
                    ? "Sending…"
                    : "Resend confirmation email"}
                </button>
              )
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-lg shadow-sm shadow-black/5"
          disabled={submitting}
        >
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Brosplit?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
