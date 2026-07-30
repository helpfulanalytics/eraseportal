"use client";

/**
 * Two steps: set a password, then a short client-onboarding step (name
 * confirmation + avatar) before landing in the workspace.
 *
 * Step 1 reuses `signUp()` from auth-actions — it creates the Firebase user
 * and establishes the session; the existing uid↔email adoption logic in
 * `getCurrentUser()` links that new account to the pre-seeded `Person`
 * automatically the first time it runs, no separate linking step needed.
 * `acceptInviteAction` marks the invite used and hands back `personId` and
 * `organizationSlug` so step 2 doesn't need a second lookup.
 */
import { useState } from "react";
import { PasswordStep } from "@/components/invite-password-step";
import { ProfileStep } from "@/components/invite-profile-step";

export function InviteAcceptForm({
  token,
  name,
  email,
  organizationName,
}: {
  token: string;
  name: string;
  email: string;
  organizationName: string;
}) {
  const [step, setStep] = useState<{
    kind: "password";
  } | {
    kind: "profile";
    personId: string;
    organizationSlug: string;
  }>({ kind: "password" });

  if (step.kind === "password") {
    return (
      <PasswordStep
        token={token}
        email={email}
        name={name}
        organizationName={organizationName}
        onDone={(result) =>
          setStep({
            kind: "profile",
            personId: result.personId,
            organizationSlug: result.organizationSlug,
          })
        }
      />
    );
  }

  return (
    <ProfileStep
      personId={step.personId}
      organizationSlug={step.organizationSlug}
      initialName={name}
    />
  );
}
