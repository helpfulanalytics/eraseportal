"use server";

/**
 * Sharing mutations for folders, boards, documents, embeds and conversations.
 *
 * Both actions here used to check only that *someone* was signed in, with a
 * TODO where the authorization belonged. Server actions are POST endpoints
 * whether or not any UI calls them — and the share dialog's role UI is behind
 * `FLAGS.shareDialog`, so nothing exercised them — which meant any client
 * could post a resource id and write themselves into its `roles` map. Since
 * `filterByFolderAccess` and `requireFolderAccess` treat the presence of a
 * key there as access, that was a way to open any resource in their
 * organization. `requireResourceManage` is that missing check.
 */
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import {
  assertGrantablePerson,
  requireResourceManage,
  type ShareableType,
} from "@/lib/access-guard";

const COLLECTIONS: Record<ShareableType, string> = {
  conversation: "conversations",
  folder: "folders",
  document: "documents",
  board: "boards",
  embed: "embeds",
};

export async function updateResourceAccess(
  resourceId: string,
  resourceType: ShareableType,
  access: "invited" | "link",
) {
  await requireResourceManage(resourceType, resourceId);

  await adminDb()
    .collection(COLLECTIONS[resourceType])
    .doc(resourceId)
    .update({ access });

  revalidatePath("/w/[orgSlug]", "layout");
}

export async function setResourceRole(
  resourceId: string,
  resourceType: ShareableType,
  personId: string,
  role: "viewer" | "editor" | "full" | null,
) {
  const { organizationId } = await requireResourceManage(
    resourceType,
    resourceId,
  );

  // Granting checks the recipient; revoking doesn't need to. Removing a
  // stale grant should keep working even if the person it names has since
  // been removed from the workspace — that's cleanup, not escalation.
  if (role !== null) {
    await assertGrantablePerson(personId, organizationId);
  }

  const ref = adminDb().collection(COLLECTIONS[resourceType]).doc(resourceId);

  if (role === null) {
    const { FieldValue } = await import("firebase-admin/firestore");
    await ref.update({ [`roles.${personId}`]: FieldValue.delete() });
  } else {
    await ref.update({ [`roles.${personId}`]: role });
  }

  revalidatePath("/w/[orgSlug]", "layout");
}
