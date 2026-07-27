import { AuthCenteredSigninShowcasePage } from "@/components/auth-centered-signin";
import { requireGuest } from "@/lib/auth-guard";

// Next 16: searchParams is a Promise and must be awaited.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Doubles as the guard and as the sanitised destination the form uses once
  // credentials check out.
  const destination = await requireGuest(next);

  return <AuthCenteredSigninShowcasePage next={destination} />;
}
