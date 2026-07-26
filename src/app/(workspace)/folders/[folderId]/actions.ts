"use server";

/**
 * Server action closing the upload loop: the browser has already written the
 * bytes to Storage, this records them in Firestore so the folder renders them.
 */
import { revalidatePath } from "next/cache";
import { createFolderFile, getCurrentUser } from "@/lib/kitchen-data";

/** "report.pdf" → "PDF". Falls back to the generic label for extensionless names. */
function labelFor(name: string): string {
  const extension = name.includes(".") ? name.split(".").pop() : undefined;
  return extension ? extension.toUpperCase().slice(0, 5) : "File";
}

export async function registerUpload(input: {
  folderId: string;
  name: string;
  bytes: number;
  mime: string;
  storagePath: string;
  downloadUrl: string;
}) {
  // Never trust the caller for identity — a server action is a public HTTP
  // endpoint, so the author comes from the session, not the payload.
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");

  await createFolderFile({
    ...input,
    authorId: me.id,
    label: labelFor(input.name),
  });

  revalidatePath(`/folders/${input.folderId}`);
  revalidatePath("/library");
}
