import { redirect } from "next/navigation";
import { NoAccessNotice } from "@/components/auth-no-access";
import { getCurrentUser } from "@/lib/kitchen-data";
import { getSessionUser } from "@/lib/firebase/session";

/**
 * The dead end for an account that authenticates but isn't in the workspace.
 *
 * Since `getCurrentUser` stopped auto-provisioning (the workspace is
 * invite-only now), such a session resolves to `null` everywhere — the same
 * value as signed-out. Without this page, that account gets bounced to
 * `/sign-in`, signs in successfully, and gets bounced again, with nothing on
 * screen explaining why. The two cases are only distinguishable by asking
 * auth and the directory separately, which is what this does.
 *
 * Public, because by definition the visitor has no workspace identity — but
 * it verifies rather than trusts: a genuinely signed-out visitor is sent to
 * sign-in, and one who *does* have a Person is sent home, so the page can't
 * be used to imply an account exists.
 */
export default async function NoAccessPage() {
  const session = await getSessionUser();
  if (!session) redirect("/sign-in");

  const me = await getCurrentUser();
  if (me) redirect("/");

  return <NoAccessNotice email={session.email} />;
}
