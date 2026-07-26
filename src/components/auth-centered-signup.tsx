"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { authErrorMessage, signUp } from "@/lib/firebase/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

export function AuthCenteredSignupShowcasePage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <PageBackdrop />
      <div className="relative w-full max-w-sm">
        <Card className="p-7">
          <CardHeader className="flex flex-col items-center gap-4 p-0 text-center">
            <BrandMark />
            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-2xl tracking-tight">
                Create your account
              </h1>
              <p className="text-muted-foreground text-sm">
                Set up your scratchpad in a minute
              </p>
            </div>
          </CardHeader>

          <CardPanel className="mt-6 flex flex-col gap-5 p-0">
            <OAuthRow />
            <OrSeparator />
            <SignUpForm />
            <FooterLinks />
          </CardPanel>
        </Card>
      </div>
    </div>
  );
}

function PageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: [
          "radial-gradient(50% 40% at 0% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)",
          "radial-gradient(55% 45% at 100% 100%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%)",
        ].join(", "),
      }}
    />
  );
}

function BrandMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      className="size-9"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <circle
        cx="20"
        cy="20"
        r="17"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <rect x="11" y="11" width="18" height="18" rx="3" fill="currentColor" />
      <path
        d="M16 22.5c.6.7 1.7 1.2 2.9 1.2 1.5 0 2.6-.7 2.6-1.8 0-1-.7-1.5-2.2-1.8l-.9-.2c-.9-.2-1.3-.5-1.3-1 0-.6.6-1 1.4-1 .9 0 1.5.4 1.7 1l1.4-.5c-.3-1.1-1.4-1.8-3-1.8-1.6 0-2.7.8-2.7 2 0 1 .7 1.6 2.1 1.9l.9.2c.9.2 1.4.5 1.4 1.1 0 .6-.6 1-1.5 1-1 0-1.7-.4-2-1.1l-1.5.6Z"
        fill="var(--background)"
      />
    </svg>
  );
}

function OAuthRow() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Button variant="outline" type="button">
        <GitHubIcon />
        GitHub
      </Button>
      <Button variant="outline" type="button">
        <GoogleIcon />
        Google
      </Button>
    </div>
  );
}

function OrSeparator() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
        Or continue with email
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setPending(true);
    setError(null);

    try {
      await signUp(email.trim(), password, name.trim());
      router.refresh();
      router.push("/onboarding");
    } catch (cause) {
      setError(authErrorMessage(cause));
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
        <Input
          id="signup-name"
          type="text"
          required
          placeholder="Jane Doe"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          nativeInput
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="signup-email">Email</FieldLabel>
        <Input
          id="signup-email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          nativeInput
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="signup-password">Password</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="signup-password"
            type={reveal ? "text" : "password"}
            required
            placeholder="Create a password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            nativeInput
          />
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {reveal ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </InputGroupAddon>
        </InputGroup>
      </Field>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Create account
      </Button>
    </form>
  );
}

function FooterLinks() {
  return (
    <div className="flex items-center justify-center gap-4 text-xs">
      <p className="text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" className="size-4">
      <path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.5-1.5 7.8-5.8 7.8-10.8C23.4 5.6 18.3.5 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#EA4335"
        d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15 .5 12 .5 7.3.5 3.3 3.2 1.4 7.1l3.8 3c.9-2.8 3.5-4.6 6.8-4.6Z"
      />
      <path
        fill="#34A853"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.6Z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1l-3.8-3C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.6Z"
      />
      <path
        fill="#4285F4"
        d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.3 0-6-2-6.9-4.6l-3.8 3C3.3 20.8 7.3 23.5 12 23.5Z"
      />
    </svg>
  );
}
