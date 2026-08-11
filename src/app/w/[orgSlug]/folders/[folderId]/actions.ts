"use server";

/**
 * Server action closing the upload loop: the browser has already written the
 * bytes to Storage, this records them in Firestore so the folder renders them.
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  createFolderFile,
  getCurrentUser,
  getFolder,
  getOrganization,
  getPeople,
} from "@/lib/kitchen-data";
import { adminMessaging } from "@/lib/firebase/admin";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/kitchen-format";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

  // `after()`, not a bare fire-and-forget call: the function may be torn
  // down the moment the response is sent, before an un-awaited promise's
  // work (the email/push fan-out below) gets a chance to run.
  after(() =>
    notifyMembersOfUpload({ folderId: input.folderId, fileName: input.name, uploader: me }).catch(
      (cause) => console.error("Couldn't send upload notification:", cause),
    ),
  );

  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]/library", "page");
}

/**
 * Best-effort — a failed send must never fail the upload it rides with.
 * Notifies every agency member but the uploader themself, so a member
 * uploading on a client's behalf doesn't get an email about their own
 * action.
 */
async function notifyMembersOfUpload(input: {
  folderId: string;
  fileName: string;
  uploader: { id: string; name: string };
}): Promise<void> {
  const folder = await getFolder(input.folderId);
  if (!folder) return;

  const organization = folder.organizationId
    ? await getOrganization(folder.organizationId)
    : undefined;
  const folderUrl = organization
    ? `${SITE_URL}/w/${organization.slug}/folders/${folder.id}`
    : SITE_URL;

  const people = await getPeople();
  const recipients = Object.values(people).filter(
    (person) => person.kind === "member" && person.id !== input.uploader.id,
  );

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendEmail({
          to: recipient.email,
          subject: `${input.uploader.name} uploaded a file to ${folder.name}`,
          html: `
            <p>${escapeHtml(input.uploader.name)} added <strong>${escapeHtml(input.fileName)}</strong> to <strong>${escapeHtml(folder.name)}</strong>.</p>
            <p><a href="${folderUrl}">Open the folder</a></p>
          `,
        });
      } catch (cause) {
        console.error("Couldn't send upload email:", cause);
      }

      if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
        try {
          await adminMessaging().sendEachForMulticast({
            tokens: recipient.fcmTokens,
            notification: {
              title: `New upload in ${folder.name}`,
              body: `${input.uploader.name} added ${input.fileName}`,
            },
            data: { url: folderUrl },
          });
        } catch (fcmError) {
          console.error("Couldn't send push notification:", fcmError);
        }
      }
    }),
  );
}
