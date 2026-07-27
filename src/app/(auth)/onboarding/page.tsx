import { AuthCenteredOnboardingShowcasePage } from "@/components/auth-centered-onboarding";
import { requireSession } from "@/lib/auth-guard";

export default async function OnboardingPage() {
  // Onboarding sits in the `(auth)` group, outside the workspace layout that
  // normally enforces a session — but you only reach it by signing up, so it
  // needs its own check. Without one it's a public page.
  await requireSession();

  return <AuthCenteredOnboardingShowcasePage />;
}
