/**
 * Page-level authorization. Every dynamic workspace route (folder, board,
 * conversation, document, embed) is reachable by URL alone today — nothing
 * stops a client from typing another organization's id in and rendering it.
 * These helpers are the actual security boundary; hiding a link in the
 * sidebar is not.
 */
import { notFound, redirect } from "next/navigation";
import {
  getBoard,
  getConversation,
  getCurrentUser,
  getDocument,
  getEmbed,
  getFolder,
  getFolders,
  getOrganizationBySlug,
  getPerson,
} from "./kitchen-data";
import { getSessionUser } from "./firebase/session";
import { canManageResource, canManageTeam } from "./permissions";
import type { Folder, Organization, Person, ResourceRoles } from "./kitchen-types";

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
 * The gate for `/team`. Sends anyone without team-management rights back to
 * the dashboard rather than 404ing: unlike a folder, the page's existence
 * isn't a secret — a plain `member` knows there's a team, they just don't
 * administer it.
 */
export async function requireTeamPage(): Promise<Person> {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  if (!canManageTeam(me)) redirect("/");
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
  if (!me) {
    // Same two-case split as `(workspace)/layout.tsx`: an authenticated
    // account with no workspace identity needs an explanation, not a sign-in
    // form it can complete and end up right back here.
    if (await getSessionUser()) redirect("/no-access");
    redirect(`/sign-in?next=${encodeURIComponent(`/w/${slug}`)}`);
  }
  if (me.kind === "client" && me.organizationId !== organization.id) {
    notFound();
  }

  return { organization, me };
}

/* ---- sharing --------------------------------------------------------- */

export type ShareableType =
  | "conversation"
  | "folder"
  | "document"
  | "board"
  | "embed";

type Shareable = {
  id: string;
  folderId?: string;
  organizationId?: string;
  authorId?: string;
  roles?: ResourceRoles;
};

const LOADERS: Record<
  ShareableType,
  (id: string) => Promise<Shareable | undefined>
> = {
  folder: getFolder,
  conversation: getConversation,
  document: getDocument,
  board: getBoard,
  embed: getEmbed,
};

/**
 * The gate for changing who can reach something — the share dialog's access
 * toggle and its per-person role map.
 *
 * Throws rather than navigating, following `requireInboxScope` above: this
 * runs inside a server action, whose caller is a `fetch` that needs an error
 * it can show, not a redirect.
 *
 * Granting a role is a genuine privilege even though `viewer`/`editor`/`full`
 * currently read alike (see `ResourceRoles`): the read path checks only that
 * a key is *present*, so writing one into this map is what opens the
 * resource. Both share actions previously checked nothing beyond "is signed
 * in", which let any client grant themselves access to anything in their org
 * by posting a resource id.
 *
 * Two checks, because the pure predicate can't do the first: the resource has
 * to be inside the caller's organization at all, and then the caller has to
 * be someone who may re-share it.
 */
export async function requireResourceManage(
  resourceType: ShareableType,
  resourceId: string,
): Promise<{ me: Person; resource: Shareable; organizationId?: string }> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");

  const resource = await LOADERS[resourceType](resourceId);
  if (!resource) throw new Error("That no longer exists.");

  // A folder carries its own `organizationId`; everything else reaches one
  // only through the folder it lives in.
  const folder =
    resourceType === "folder"
      ? (resource as Folder)
      : resource.folderId
        ? await getFolder(resource.folderId)
        : undefined;
  if (!folder) throw new Error("That no longer exists.");

  if (me.kind === "client" && folder.organizationId !== me.organizationId) {
    throw new Error("You don't have access to that.");
  }
  if (!canManageResource(me, resource)) {
    throw new Error("You don't have permission to change sharing on that.");
  }

  return { me, resource, organizationId: folder.organizationId };
}

/**
 * A role may only be granted to someone who could plausibly hold it — a
 * member (who sees everything anyway) or a client of the resource's own
 * organization. Without this, a valid manager could mint a grant for a
 * stranger's `Person.id` and hand another tenant's client a way in.
 */
export async function assertGrantablePerson(
  personId: string,
  organizationId: string | undefined,
): Promise<void> {
  const person = await getPerson(personId);
  if (!person) throw new Error("That person doesn't exist.");
  if (person.deactivatedAt) throw new Error("That person has been removed.");
  if (person.kind === "member") return;
  if (!organizationId || person.organizationId !== organizationId) {
    throw new Error("That person isn't part of this organization.");
  }
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
