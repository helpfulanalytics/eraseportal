/**
 * Page-level authorization. Every dynamic workspace route (folder, board,
 * conversation, document, embed) is reachable by URL alone today — nothing
 * stops a client from typing another organization's id in and rendering it.
 * These helpers are the actual security boundary; hiding a link in the
 * sidebar is not.
 */
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getFolders, getOrganizationBySlug } from "./kitchen-data";
import type { Folder, Organization, Person } from "./kitchen-types";

/**
 * 404s unless the signed-in person is a member (sees everything) or a client
 * whose `organizationId` matches the folder's. Returns the current person so
 * callers that also need it don't have to fetch it twice.
 *
 * Takes `Folder | undefined` rather than requiring the caller to narrow
 * first — `notFound()` throws (return type `never`), but TypeScript can't
 * see through an `await` to know that, so callers still need their own
 * `if (!folder) notFound()` for narrowing before they read folder fields.
 * This function's own `undefined` check exists for callers that don't need
 * that narrowing at all (see `folders/[folderId]/page.tsx`, which does).
 */
export async function requireFolderAccess(folder: Folder | undefined): Promise<Person> {
  if (!folder) notFound();
  const me = await getCurrentUser();
  if (!me) notFound();
  
  if (me.kind === "member") return me;

  if (me.kind === "client") {
    if (folder.organizationId !== me.organizationId) notFound();
    if (folder.authorId !== me.id && !folder.roles?.[me.id]) notFound();
  }
  
  return me;
}

/** Redirects non-members away from the admin section entirely. */
export async function requireAdminPage(): Promise<Person> {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  if (me.kind !== "member") redirect("/");
  return me;
}

/**
 * The gate for `/w/[orgSlug]/*` — every org-scoped workspace route. 404s on
 * an unknown slug (same "don't confirm existence to someone with no access"
 * shape as `requireFolderAccess`), and 404s a client whose own org doesn't
 * match, so a guessed slug never leaks another org's data.
 */
export async function requireOrgWorkspaceAccess(
  slug: string,
): Promise<{ organization: Organization; me: Person }> {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  const me = await getCurrentUser();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/w/${slug}`)}`);
  if (me.kind === "client" && me.organizationId !== organization.id) {
    notFound();
  }

  return { organization, me };
}

/**
 * The gate for the Inbox panel's reads.
 *
 * Same boundary as `requireOrgWorkspaceAccess`, but it **throws instead of
 * calling `notFound()`/`redirect()`** — those are page-render controls, and
 * this runs inside a server action, where the caller is a `fetch` that needs
 * an error it can show in the panel rather than a navigation.
 *
 * Returns the organization's folders as well, because every Inbox tab scopes
 * by folder id: a message, task and file all reach their organization only
 * through the folder they sit in.
 */
export async function requireInboxScope(slug: string): Promise<{
  me: Person;
  organizationId: string;
  folders: Folder[];
  folderIds: Set<string>;
}> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");

  const organization = await getOrganizationBySlug(slug);
  if (!organization) throw new Error("That workspace no longer exists.");
  if (me.kind === "client" && me.organizationId !== organization.id) {
    throw new Error("You don't have access to that workspace.");
  }

  const folders = await getFolders({ organizationId: organization.id });
  return {
    me,
    organizationId: organization.id,
    folders,
    folderIds: new Set(folders.map((folder) => folder.id)),
  };
}
