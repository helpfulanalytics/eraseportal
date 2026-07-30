"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { authErrorMessage, signUp } from "@/lib/firebase/auth-actions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
};

export function AuthCenteredSignupShowcasePage() {
  return (
    <div className="relative flex min-h-svh w-full flex-col bg-background text-foreground">
      <PageBackdrop />

      <div className="relative p-5 md:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md transition-opacity duration-200 hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BrandMark size={24} />
          <span className="font-heading text-base font-semibold tracking-tight">
            Erase Friction Portal
          </span>
        </Link>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 pb-16 md:px-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm"
        >
          <motion.div variants={itemVariants} className="mb-7">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Create your account
            </h1>
            <p className="mt-1.5 text-muted-foreground text-sm">
              Set up your workspace in a minute
            </p>
          </motion.div>

          <SignUpForm />
          <FooterLinks />
        </motion.div>
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

function SignUpForm() {
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
      // Hard navigation for the same reason as sign-in: the session cookie was
      // set outside the router's knowledge, so a client-side push can render
      // the destination with a stale, signed-out payload.
      window.location.replace("/onboarding");
      return;
    } catch (cause) {
      setError(authErrorMessage(cause));
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <motion.div variants={itemVariants}>
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
      </motion.div>

      <motion.div variants={itemVariants}>
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
      </motion.div>

      <motion.div variants={itemVariants}>
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
      </motion.div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      <motion.div variants={itemVariants}>
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          Create account
        </Button>
      </motion.div>
    </form>
  );
}

function FooterLinks() {
  return (
    <motion.div
      variants={itemVariants}
      className="mt-6 flex items-center justify-center gap-4 text-xs"
    >
      <p className="text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
