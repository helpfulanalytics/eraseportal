"use client";

import { type FormEvent, useState } from "react";
import { motion, type Variants } from "motion/react";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { acceptInviteAction } from "@/app/(workspace)/actions";
import { authErrorMessage, signUp } from "@/lib/firebase/auth-actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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

export function PasswordStep({
  token,
  email,
  name,
  organizationName,
  onDone,
}: {
  token: string;
  email: string;
  name: string;
  organizationName: string;
  onDone: (result: { personId: string; organizationSlug: string }) => void;
}) {
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password) return;

    setPending(true);
    setError(null);

    try {
      await signUp(email, password, name);
      const result = await acceptInviteAction(token);
      onDone(result);
    } catch (cause) {
      setError(authErrorMessage(cause));
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background px-6 text-foreground">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm"
      >
        <motion.div variants={itemVariants} className="mb-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Create a password
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            You&apos;re joining {organizationName}&apos;s workspace.
          </p>
        </motion.div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <motion.div variants={itemVariants}>
            <Field>
              <FieldLabel htmlFor="invite-password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="invite-password"
                  type={reveal ? "text" : "password"}
                  required
                  placeholder="Create a password"
                  autoComplete="new-password"
                  autoFocus
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
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  Continuing…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
