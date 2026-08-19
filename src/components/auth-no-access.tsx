"use client";

/**
 * Shown to someone who is authenticated but has no workspace identity.
 *
 * Deliberately offers exactly one action. Signing out is the only thing that
 * gets them anywhere — retrying sign-in with the same account lands right
 * back here, and there's nothing self-serve to do, because joining requires
 * someone already inside to send an invite.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/firebase/auth-actions";

export function NoAccessNotice({ email }: { email?: string }) {
  const [pending, setPending] = useState(false);

  const onSignOut = async () => {
    setPending(true);
    try {
      await signOut();
      // Hard navigation, matching `UserMenu`: the cookie is cleared by a
      // fetch the router can't see, so its cache still holds signed-in
      // renders. A client-side push would show them.
      window.location.replace("/sign-in");
    } catch {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-sm text-center">
        <h1 className="font-heading font-bold text-xl tracking-tight">
          You&apos;re not part of this workspace
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {email ? (
            <>
              You&apos;re signed in as <span className="text-foreground">{email}</span>, but
              that account hasn&apos;t been invited yet.
            </>
          ) : (
            <>That account hasn&apos;t been invited yet.</>
          )}{" "}
          Ask someone on the team to send you an invite.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          disabled={pending}
          onClick={onSignOut}
        >
          {pending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}
