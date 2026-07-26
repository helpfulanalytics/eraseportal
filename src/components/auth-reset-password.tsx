"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import { requestPasswordReset } from "@/lib/firebase/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AuthResetPasswordShowcasePage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || pending) return;

    setPending(true);

    try {
      await requestPasswordReset(email.trim());
    } catch {
      // Deliberately swallowed: reporting "no such account" here would turn
      // this form into a way to test which emails are registered. Firebase
      // sends nothing for an unknown address, and the confirmation below is
      // worded to be true either way.
    }

    setPending(false);
    setSent(true);
  };

  const reset = () => {
    setSent(false);
    setEmail("");
  };

  return (
    <div className="relative min-h-svh bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        {sent ? (
          <SentState
            email={email}
            onTryDifferent={reset}
          />
        ) : (
          <RequestState
            email={email}
            setEmail={setEmail}
            pending={pending}
            onSubmit={onSubmit}
          />
        )}
      </Card>

      <button
        type="button"
        onClick={() => (sent ? reset() : setSent(true))}
        className="absolute right-4 bottom-4 cursor-pointer rounded font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] opacity-40 transition-opacity hover:opacity-80 focus-visible:opacity-80 focus-visible:outline-none"
      >
        Demo: toggle state →
      </button>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center justify-center">
      <div className="flex size-8 items-center justify-center rounded-md bg-foreground">
        <span className="block size-2 rounded-full bg-background" />
      </div>
    </div>
  );
}

function RequestState({
  email,
  setEmail,
  pending,
  onSubmit,
}: {
  email: string;
  setEmail: (value: string) => void;
  pending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <CardHeader className="items-center text-center">
        <BrandMark />
        <CardTitle className="mt-4 font-heading text-2xl tracking-tight">
          Reset your password
        </CardTitle>
        <CardDescription className="text-sm">
          Enter your email and we&apos;ll send you a link to reset it.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="reset-email">Email</FieldLabel>
            <Input
              id="reset-email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              nativeInput
            />
          </Field>

          <Button type="submit" size="lg" loading={pending} className="mt-1">
            Send reset link
          </Button>
        </form>
      </CardPanel>
      <CardFooter className="justify-center">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          Back to sign in
        </Link>
      </CardFooter>
    </>
  );
}

function SentState({
  email,
  onTryDifferent,
}: {
  email: string;
  onTryDifferent: () => void;
}) {
  return (
    <>
      <CardHeader className="items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckIcon className="size-6 text-emerald-600" />
        </div>
        <CardTitle className="mt-4 font-heading text-2xl tracking-tight">
          Check your inbox
        </CardTitle>
        <CardDescription className="text-sm break-words">
          We sent a reset link to{" "}
          <strong className="text-foreground break-all">{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <p className="text-center text-muted-foreground text-xs">
          The link expires in 30 minutes. Didn&apos;t get it? Check your spam
          folder.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="lg">
            Resend link
          </Button>
          <Button variant="ghost" size="lg" onClick={onTryDifferent}>
            Try a different email
          </Button>
        </div>
      </CardPanel>
      <CardFooter className="justify-center">
        <Link
          href="/sign-in"
          className="text-muted-foreground text-xs hover:text-foreground"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </>
  );
}
