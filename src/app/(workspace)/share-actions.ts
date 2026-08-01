"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/firebase/session";

type ResourceType = "conversation" | "folder" | "document" | "board" | "embed";

const COLLECTIONS: Record<ResourceType, string> = {
  conversation: "conversations",
  folder: "folders",
  document: "documents",
  board: "boards",
  embed: "embeds",
};

export async function updateResourceAccess(
  resourceId: string,
  resourceType: ResourceType,
  access: "invited" | "link",
) {
  const session = await getSessionUser();
  if (!session) {
    throw new Error("Must be signed in to change access");
  }

  // TODO: Verify if the user has permission to change access for this resource.
  // For now, we update it if they are logged in.

  const collectionName = COLLECTIONS[resourceType];
  
  await adminDb()
    .collection(collectionName)
    .doc(resourceId)
    .update({ access });
}

export async function setResourceRole(
  resourceId: string,
  resourceType: ResourceType,
  personId: string,
  role: "viewer" | "editor" | "full" | null,
) {
  const session = await getSessionUser();
  if (!session) {
    throw new Error("Must be signed in to change roles");
  }

  // TODO: Verify if the user has permission to change roles (is admin or full access)

  const collectionName = COLLECTIONS[resourceType];
  const ref = adminDb().collection(collectionName).doc(resourceId);

  if (role === null) {
    // Remove the role
    const { FieldValue } = await import("firebase-admin/firestore");
    await ref.update({
      [`roles.${personId}`]: FieldValue.delete(),
    });
  } else {
    // Set the role
    await ref.update({
      [`roles.${personId}`]: role,
    });
  }
}
