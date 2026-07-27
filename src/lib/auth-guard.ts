/**
 * Guard for the `(auth)` route group. **Server-only** — reaches the Admin SDK
 * through `getCurrentUser`.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/kitchen-data";
import { safeNext } from "@/lib/navigation";

/**
 * Send an already-signed-in visitor to where they were going, and otherwise
 * hand back the sanitised destination for the form to use after sign-in.
 *
 * This lives on the page rather than in the proxy on purpose. The proxy only
 * knows whether a cookie *exists*; bouncing people off `/sign-in` on that
 * basis would trap anyone holding an expired cookie in a loop between the
 * workspace layout and this page. Here the session is genuinely verified, so
 * an invalid cookie simply renders the form.
 */
export async function requireGuest(next?: string): Promise<string> {
  const destination = safeNext(next);
  const user = await getCurrentUser();
  if (user) redirect(destination);
  return destination;
}

/**
 * The mirror image, for pages that need a session but sit outside the
 * workspace layout that normally enforces one — onboarding, currently.
 */
export async function requireSession(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
}
