"use client";

/**
 * Two steps: set a password, then a short onboarding step (name confirmation
 * + avatar) before landing in the workspace.
 *
 * Serves both audiences — a client claiming their seat in one organization,
 * and an agency member joining the team — because the mechanics are
 * identical and only the wording and the landing page differ.
 *
 * Step 1 reuses `signUp()` from auth-actions — it creates the Firebase user
 * and establishes the session; the existing uid↔email adoption logic in
 * `getCurrentUser()` links that new account to the pre-seeded `Person`
 * automatically the first time it runs, no separate linking step needed.
 * That adoption is now the *only* way an authenticated account acquires a
 * workspace identity, which is what makes the workspace invite-only.
 * `acceptInviteAction` marks the invite used and hands back `personId` and
 * a ready-made `destination` so step 2 doesn't need a second lookup.
 */
import { useState } from "react";
import { PasswordStep } from "@/components/invite-password-step";
import { ProfileStep } from "@/components/invite-profile-step";

export function InviteAcceptForm({
  token,
  name,
  email,
  destinationName,
  audience,
}: {
  token: string;
  name: string;
  email: string;
  /** The organization's name for a client, the workspace's for a member. */
  destinationName: string;
  audience: "member" | "client";
}) {
  const [step, setStep] = useState<{
    kind: "password";
  } | {
    kind: "profile";
    personId: string;
    destination: string;
  }>({ kind: "password" });

  if (step.kind === "password") {
    return (
      <PasswordStep
        token={token}
        email={email}
        name={name}
        destinationName={destinationName}
        audience={audience}
        onDone={(result) =>
          setStep({
            kind: "profile",
            personId: result.personId,
            destination: result.destination,
          })
        }
      />
    );
  }

  return (
    <ProfileStep
      personId={step.personId}
      destination={step.destination}
      initialName={name}
    />
  );
}
