import { AuthCenteredSignupShowcasePage } from "@/components/auth-centered-signup";
import { requireGuest } from "@/lib/auth-guard";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  await requireGuest(next);

  // New accounts go to onboarding regardless of `next` — there's nothing
  // useful to return to yet.
  return <AuthCenteredSignupShowcasePage />;
}
