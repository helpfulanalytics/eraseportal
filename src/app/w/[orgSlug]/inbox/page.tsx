import { redirect } from "next/navigation";
import { requireOrgWorkspaceAccess } from "@/lib/access-guard";

/**
 * The Inbox stopped being a page.
 *
 * It's a shell panel now (`components/shell/inbox-sidebar.tsx`): the rail's
 * Inbox button swaps the left panel and leaves the page alone, so opening a
 * message shows the conversation in the card beside the list instead of
 * navigating away from the inbox and back. That's the behaviour the old page
 * couldn't have — its reading pane was a permanent empty state.
 *
 * This route survives only so links and bookmarks to `/inbox` don't 404. It
 * lands on the workspace home; the panel's own open/closed state is a client
 * preference in localStorage, which a redirect can't set.
 */
export default async function InboxPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await requireOrgWorkspaceAccess(orgSlug);
  redirect(`/w/${orgSlug}`);
}
