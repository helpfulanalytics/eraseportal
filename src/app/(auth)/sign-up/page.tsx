import { redirect } from "next/navigation";

/**
 * Retired — the workspace is invite-only. Self-serve sign-up was the only
 * thing `provisionPerson` existed for, and it handed anyone who filled in the
 * form a `kind: "member"` identity with reach over every organization.
 *
 * Account creation still happens, just never here: `PasswordStep` inside
 * `/invite/[token]` calls `signUp()` from `auth-actions.ts` directly, behind
 * a token that proves someone already inside chose to let this person in.
 *
 * Kept as a redirect rather than deleted outright, matching `/clients` and
 * `/admin` — an old bookmark or a stale link in an email should land
 * somewhere real. `auth-centered-signup.tsx` is left in the tree too, unused,
 * for whenever self-serve signup is worth having again.
 */
export default function SignUpPage() {
  redirect("/sign-in");
}
