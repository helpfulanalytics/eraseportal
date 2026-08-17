"use server";

/**
 * Workspace-wide mutations.
 *
 * Server actions are public HTTP endpoints, so every one of these takes the
 * acting user from the session rather than from its arguments. A caller can
 * choose *what* to write; it never gets to choose *who* wrote it.
 *
 * Folder-scoped file uploads live in `src/app/w/[orgSlug]/folders/[folderId]/actions.ts`
 * instead, because they're coupled to that route's Storage prefix.
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  addBoardColumn,
  addCardComment,
  addDeviceToken,
  createBoard,
  createCard,
  createClient,
  createConversation,
  createDocument,
  createEmbed,
  createFolder,
  createInvite,
  createOrganization,
  createTask,
  deleteConversation,
  deleteBoard,
  deleteBoardColumn,
  deleteCard,
  deleteDocument,
  deleteEmbed,
  deleteFolder,
  deleteFolderFile,
  getBoard,
  getConversation,
  getCurrentUser,
  getDocument,
  getEmbed,
  getFolder,
  getFolderItem,
  getMessage,
  getInviteByToken,
  getOrganization,
  isInviteExpired,
  getPerson,
  getTasks,
  markInviteUsed,
  moveCard,
  removeDeviceToken,
  renameBoard,
  renameBoardColumn,
  renameConversation,
  renameDocument,
  renameFolder,
  renameOrganization,
  saveDocumentContent,
  saveDocumentNodes,
  sendMessage,
  setFolderColor,
  setFolderCoverUrl,
  setFolderDescription,
  setBoardColor,
  setPersonProfile,
  setStarred,
  setTaskCompleted,
  setWorkspaceName,
  toggleReaction,
  updateCard,
  updateFolderPosition,
  reorderFolderItems,
  type StarrableKind,
} from "@/lib/kitchen-data";
import { sanitizeCanvasNodes } from "@/lib/canvas";
import { documentKind, sanitizeDocBlocks } from "@/lib/doc-blocks";
import type {
  Attachment,
  DocumentKind,
  FolderAccess,
  ItemKind,
  Person,
  Reaction,
} from "@/lib/kitchen-types";
import { adminMessaging } from "@/lib/firebase/admin";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/kitchen-format";

/** Every mutation needs an identity; none of them accept one as input. */
async function requireUser() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");
  return me;
}

/** Org/folder/board/client management is admin-only — `kind: "member"`. */
async function requireAdmin() {
  const me = await requireUser();
  if (me.kind !== "member") throw new Error("Admins only.");
  return me;
}

/**
 * Clients may act within their own organization's folders; members may act
 * anywhere. Throws rather than silently no-op'ing so a client who tampers
 * with a folder id in a form submission gets a clear rejection.
 */
async function assertOrgAccess(me: Person, folderId: string): Promise<void> {
  if (me.kind === "member") return;
  const folder = await getFolder(folderId);
  if (!folder || folder.organizationId !== me.organizationId) {
    throw new Error("You don't have access to that folder.");
  }
}

export async function updateFolderPositionAction(
  folderId: string,
  position: number,
): Promise<void> {
  const me = await requireUser();
  await assertOrgAccess(me, folderId);
  await updateFolderPosition(folderId, position);
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function reorderFolderItemsAction(
  folderId: string,
  itemIds: string[],
): Promise<void> {
  const me = await requireUser();
  await assertOrgAccess(me, folderId);
  await reorderFolderItems(folderId, itemIds);
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function createFolderAction(input: {
  name: string;
  description?: string;
  access?: FolderAccess;
  internalRole?: "viewer" | "editor";
  organizationId?: string;
  parentFolderId?: string;
}): Promise<string> {
  await requireAdmin();

  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("A folder needs a name.");

  const folder = await createFolder({
    ...input,
    name: trimmed,
    description: input.description?.trim() || undefined,
  });

  // The sidebar's folder tree is built in the workspace layout, so the whole
  // segment has to re-render — not just the page that triggered this.
  revalidatePath("/w/[orgSlug]", "layout");
  return folder.id;
}

export async function createConversationAction(
  folderId: string,
  name: string,
): Promise<string> {
  const me = await requireUser();
  await assertOrgAccess(me, folderId);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("A conversation needs a name.");

  const conversation = await createConversation({
    folderId,
    name: trimmed,
    authorId: me.id,
    // Just the creator for now. Adding participants is the share dialog's job,
    // which doesn't persist yet.
    participantIds: [me.id],
  });

  revalidatePath("/w/[orgSlug]", "layout");
  return conversation.id;
}

export async function sendMessageAction(
  conversationId: string,
  text: string,
  isNote: boolean,
  attachments: Attachment[] = [],
): Promise<void> {
  const me = await requireUser();

  const conversation = await getConversation(conversationId);
  if (!conversation) throw new Error("That conversation doesn't exist.");
  await assertOrgAccess(me, conversation.folderId);

  const trimmed = text.trim();
  const files = sanitizeAttachments(attachments);
  // An attachment on its own is a message; empty text with nothing attached
  // is not.
  if (!trimmed && files.length === 0) return;

  await sendMessage({
    conversationId,
    folderId: conversation.folderId,
    authorId: me.id,
    text: trimmed,
    isNote,
    attachments: files,
  });

  if (!isNote) {
    // A Conversation carries no `organizationId` — it reaches its tenant
    // through its folder — and `/w/…` is keyed by slug, not id. Resolved once
    // here rather than per recipient inside the notification loop.
    const folder = await getFolder(conversation.folderId);
    const organization = folder?.organizationId
      ? await getOrganization(folder.organizationId)
      : undefined;
    const conversationUrl = organization
      ? `${SITE_URL}/w/${organization.slug}/conversations/${conversation.id}`
      : SITE_URL;

    const recipients = conversation.participantIds.filter((id) => id !== me.id);
    await Promise.all(
      recipients.map(async (id) => {
        try {
          const recipient = await getPerson(id);
          if (!recipient) return;
          await sendEmail({
            to: recipient.email,
            subject: `${me.name} sent a message in ${conversation.name}`,
            html: `
              <p>${escapeHtml(me.name)} wrote in <strong>${escapeHtml(conversation.name)}</strong>:</p>
              <p>${escapeHtml(trimmed)}</p>
              <p><a href="${conversationUrl}">Open it</a></p>
            `,
          });

          // Desktop Notification
          if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
            try {
              const response = await adminMessaging().sendEachForMulticast({
                tokens: recipient.fcmTokens,
                notification: {
                  title: `${me.name} in ${conversation.name}`,
                  body: trimmed,
                },
                data: { url: conversationUrl }
              });
              
              // Clean up expired or revoked tokens
              if (response.failureCount > 0) {
                const failedTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                  if (!resp.success) {
                    const errCode = resp.error?.code;
                    if (errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered') {
                      failedTokens.push(recipient.fcmTokens![idx]);
                    }
                  }
                });
                
                await Promise.all(
                  failedTokens.map(token => removeDeviceToken(recipient.id, token))
                );
              }
            } catch (fcmError) {
              console.error("Couldn't send push notification:", fcmError);
            }
          }
        } catch (cause) {
          console.error("Couldn't send message notification:", cause);
        }
      }),
    );
  }

  revalidatePath("/w/[orgSlug]/conversations/[conversationId]", "page");
  // The folder listing shows a message count for the conversation.
  revalidatePath("/w/[orgSlug]", "layout");
}

/**
 * Attachments arrive from the browser, which uploaded the bytes itself — so
 * this can't check that a file exists, only that what's being stored is the
 * right shape and points somewhere safe. A `javascript:` or `data:` URL in a
 * message body would run for every reader, which is why the host is checked
 * rather than trusted.
 */
function sanitizeAttachments(input: Attachment[]): Attachment[] {
  if (!Array.isArray(input)) return [];

  return input.slice(0, 10).flatMap((raw) => {
    const url = typeof raw?.url === "string" ? raw.url.trim() : "";
    if (url && !/^https?:\/\//i.test(url)) return [];

    const name = String(raw?.name ?? "").trim().slice(0, 200);
    if (!name) return [];

    const attachment: Attachment = {
      id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 64) : randomId(),
      name,
      label: String(raw?.label ?? "File").trim().slice(0, 24) || "File",
      bytes: Number.isFinite(raw?.bytes) ? Math.max(0, Math.trunc(raw.bytes)) : 0,
    };
    // Firestore rejects `undefined`, so optional keys are omitted entirely.
    if (url) attachment.url = url.slice(0, 2048);
    if (typeof raw?.mime === "string" && raw.mime) {
      attachment.mime = raw.mime.slice(0, 128);
    }
    return [attachment];
  });
}

function randomId(): string {
  return `att_${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Adds or removes the signed-in person's reaction to a message.
 *
 * Returns the new reactions rather than revalidating: the message list holds
 * them optimistically, and a `revalidatePath` on every emoji click would
 * re-render the whole conversation to change one pill.
 */
export async function toggleReactionAction(
  messageId: string,
  emoji: string,
): Promise<Reaction[]> {
  const me = await requireUser();

  const message = await getMessage(messageId);
  if (!message) throw new Error("That message no longer exists.");

  const conversation = await getConversation(message.conversationId);
  if (!conversation) throw new Error("That conversation doesn't exist.");
  await assertOrgAccess(me, conversation.folderId);

  // One character of emoji, never a caption — this string is rendered back to
  // everyone in the conversation.
  const trimmed = emoji.trim();
  if (!trimmed || [...trimmed].length > 2) {
    throw new Error("That isn't an emoji.");
  }

  return toggleReaction({ messageId, emoji: trimmed, personId: me.id });
}

export async function setFolderDescriptionAction(
  folderId: string,
  description: string,
): Promise<void> {
  const me = await requireAdmin();
  await assertOrgAccess(me, folderId);

  await setFolderDescription(folderId, description.trim().slice(0, 2000));
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
}

/**
 * Deletes anything listed in a folder, from the folder listing's own row
 * menu.
 *
 * Board, conversation and document each already have a delete on their own
 * page. A **file has no page**, so before this there was no way to remove an
 * upload at all — it's the reason this exists rather than five links to five
 * headers.
 */
export async function deleteFolderItemAction(
  kind: ItemKind,
  id: string,
): Promise<void> {
  const me = await requireAdmin();

  switch (kind) {
    case "file": {
      const item = await getFolderItem(id);
      if (!item) return;
      await assertOrgAccess(me, item.folderId);
      await deleteFolderFile(id);
      break;
    }
    case "conversation": {
      const conversation = await getConversation(id);
      if (!conversation) return;
      await assertOrgAccess(me, conversation.folderId);
      await deleteConversation(id);
      break;
    }
    case "board": {
      const board = await getBoard(id);
      if (!board) return;
      await assertOrgAccess(me, board.folderId);
      await deleteBoard(id);
      break;
    }
    case "document": {
      const doc = await getDocument(id);
      if (!doc) return;
      await assertOrgAccess(me, doc.folderId);
      await deleteDocument(id);
      break;
    }
    case "embed": {
      const embed = await getEmbed(id);
      if (!embed) return;
      await assertOrgAccess(me, embed.folderId);
      await deleteEmbed(id);
      break;
    }
  }

  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout");
}

/**
 * Favourites, for every kind that has a star on its header.
 *
 * One action rather than five, because the only difference between them is
 * which collection the flag lands in and which folder the access check runs
 * against. Each kind reaches its folder differently — a folder *is* the
 * folder — which is what the switch below resolves.
 */
export async function setStarredAction(
  kind: StarrableKind,
  id: string,
  starred: boolean,
): Promise<void> {
  const me = await requireUser();

  const folderId = await folderOf(kind, id);
  await assertOrgAccess(me, folderId);

  await setStarred(kind, id, starred);
  // The star shows on the item's own page; the sidebar and folder listing
  // don't render it, so this is a page-level revalidation, not a layout one.
  revalidatePath(`/w/[orgSlug]/${ROUTE_SEGMENT[kind]}`, "page");
}

const ROUTE_SEGMENT: Record<StarrableKind, string> = {
  folder: "folders/[folderId]",
  conversation: "conversations/[conversationId]",
  board: "boards/[boardId]",
  document: "documents/[documentId]",
  embed: "embeds/[embedId]",
};

/** The folder an entity's access is judged against. */
async function folderOf(kind: StarrableKind, id: string): Promise<string> {
  if (kind === "folder") {
    const folder = await getFolder(id);
    if (!folder) throw new Error("That folder doesn't exist.");
    return folder.id;
  }

  const owner =
    kind === "conversation"
      ? await getConversation(id)
      : kind === "board"
        ? await getBoard(id)
        : kind === "document"
          ? await getDocument(id)
          : await getEmbed(id);

  if (!owner) throw new Error("That no longer exists.");
  return owner.folderId;
}

export async function toggleTaskAction(
  taskId: string,
  completed: boolean,
): Promise<void> {
  const me = await requireUser();
  await setTaskCompleted(taskId, completed);

  if (completed) {
    try {
      const task = (await getTasks()).find((t) => t.id === taskId);
      if (task?.authorId && task.authorId !== me.id) {
        const author = await getPerson(task.authorId);
        if (author) {
          await sendEmail({
            to: author.email,
            subject: `"${task.title}" was completed`,
            html: `<p>${escapeHtml(me.name)} marked <strong>${escapeHtml(task.title)}</strong> as done.</p>`,
          });

          // Desktop Notification
          if (author.fcmTokens && author.fcmTokens.length > 0) {
            try {
              await adminMessaging().sendEachForMulticast({
                tokens: author.fcmTokens,
                notification: {
                  title: "Task Completed",
                  body: `${me.name} marked "${task.title}" as done.`,
                },
              });
            } catch (fcmError) {
              console.error("Couldn't send push notification:", fcmError);
            }
          }
        }
      }
    } catch (cause) {
      console.error("Couldn't send task-completed notification:", cause);
    }
  }

  revalidatePath("/w/[orgSlug]/tasks", "page");
  revalidatePath("/w/[orgSlug]/tasks/me", "page");
}

/** A client raising a task/complaint, or a member creating one directly. */
export async function createTaskAction(input: {
  title: string;
  folderId?: string;
  dueDate?: string;
  assigneeId?: string;
}): Promise<string> {
  const me = await requireUser();
  if (input.folderId) await assertOrgAccess(me, input.folderId);

  const title = input.title.trim();
  if (!title) throw new Error("A task needs a title.");

  const task = await createTask({ ...input, title, authorId: me.id });

  if (input.assigneeId && input.assigneeId !== me.id) {
    try {
      const assignee = await getPerson(input.assigneeId);
      if (assignee) {
        await sendEmail({
          to: assignee.email,
          subject: `${me.name} assigned you a task`,
          html: `<p>${escapeHtml(me.name)} assigned you <strong>${escapeHtml(title)}</strong>.</p>`,
        });

        // Desktop Notification
        if (assignee.fcmTokens && assignee.fcmTokens.length > 0) {
          try {
            await adminMessaging().sendEachForMulticast({
              tokens: assignee.fcmTokens,
              notification: {
                title: "New Task Assigned",
                body: `${me.name} assigned you: ${title}`,
              },
            });
          } catch (fcmError) {
            console.error("Couldn't send push notification:", fcmError);
          }
        }
      }
    } catch (cause) {
      console.error("Couldn't send task-assigned notification:", cause);
    }
  }

  revalidatePath("/w/[orgSlug]/tasks", "page");
  revalidatePath("/w/[orgSlug]/tasks/me", "page");
  return task.id;
}

export async function renameWorkspaceAction(name: string): Promise<void> {
  await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("The workspace needs a name.");

  await setWorkspaceName(trimmed);
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function createOrganizationAction(
  name: string,
  domain: string,
): Promise<{ id: string; slug: string }> {
  await requireAdmin();

  const trimmedName = name.trim();
  const trimmedDomain = domain.trim();
  if (!trimmedName) throw new Error("An organization needs a name.");
  if (!trimmedDomain) throw new Error("An organization needs a domain.");

  const organization = await createOrganization({
    name: trimmedName,
    domain: trimmedDomain,
  });
  revalidatePath("/");
  return { id: organization.id, slug: organization.slug };
}

export async function renameOrganizationAction(
  organizationId: string,
  name: string,
): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("An organization needs a name.");

  await renameOrganization(organizationId, trimmed);
  revalidatePath("/w/[orgSlug]", "layout");
  revalidatePath("/");
}

/* ---- folder contents -------------------------------------------------- */

export async function createBoardAction(
  folderId: string,
  name: string,
): Promise<string> {
  const me = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A board needs a name.");

  const board = await createBoard({ folderId, name: trimmed, authorId: me.id });
  revalidatePath("/w/[orgSlug]", "layout");
  return board.id;
}

export async function createDocumentAction(
  folderId: string,
  name: string,
  /** `page` (Notion-style blocks) or `canvas` (Miro-style whiteboard). */
  kind: DocumentKind = "page",
): Promise<string> {
  const me = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A document needs a name.");

  const doc = await createDocument({
    folderId,
    name: trimmed,
    authorId: me.id,
    // Never trust the string off the wire — anything but "canvas" is a page.
    kind: kind === "canvas" ? "canvas" : "page",
  });
  revalidatePath("/w/[orgSlug]", "layout");
  return doc.id;
}

/**
 * The editor's autosave. Called every few seconds while someone types, so it
 * deliberately does *not* `revalidatePath`: the only thing a refresh would
 * change on this route is the body the client already has, and re-rendering
 * the page mid-keystroke would fight the editor's local state (handoff-2,
 * trap 13). The folder listing's "Updated …" line picks the new timestamp up
 * on its own next render.
 *
 * `blocks` arrives as whatever the browser posted; `sanitizeDocBlocks` is the
 * boundary, not the editor's own client-side pass.
 */
export async function saveDocumentAction(
  documentId: string,
  blocks: unknown,
): Promise<string> {
  const doc = await requireDocumentAccess(documentId);
  if (documentKind(doc) !== "page") {
    throw new Error("That document is a canvas — save its nodes instead.");
  }
  return saveDocumentContent(documentId, sanitizeDocBlocks(blocks));
}

/** The canvas half of `saveDocumentAction`, with the same trust model. */
export async function saveCanvasAction(
  documentId: string,
  nodes: unknown,
): Promise<string> {
  const doc = await requireDocumentAccess(documentId);
  if (documentKind(doc) !== "canvas") {
    throw new Error("That document is a page — save its blocks instead.");
  }
  return saveDocumentNodes(documentId, sanitizeCanvasNodes(nodes));
}

export async function renameDocumentAction(
  documentId: string,
  name: string,
): Promise<void> {
  await requireDocumentAccess(documentId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A document needs a name.");

  await renameDocument(documentId, trimmed);
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function deleteDocumentAction(documentId: string): Promise<void> {
  await requireDocumentAccess(documentId);
  await deleteDocument(documentId);
  revalidatePath("/w/[orgSlug]", "layout");
}

/**
 * Every document mutation takes only an id, so each one has to re-establish
 * that the caller may touch that document.
 *
 * Editing is **members only**, matching who can create a document in the
 * first place (`createDocumentAction` is `requireAdmin`, and the folder
 * page offers a client nothing but "New conversation"). A client can read a
 * document shared into their organization's folder — `DocumentPage` renders
 * them a read-only view — but nothing in this file lets them write one.
 *
 * `assertOrgAccess` is still called rather than skipped: it's a no-op for a
 * member today, and leaving it in means this stays correct if document
 * editing is ever opened up to clients.
 *
 * Returns the document so callers that need its kind don't read it twice.
 */
async function requireDocumentAccess(documentId: string) {
  const me = await requireAdmin();
  const doc = await getDocument(documentId);
  if (!doc) throw new Error("That document no longer exists.");
  await assertOrgAccess(me, doc.folderId);
  return doc;
}

/**
 * Backs both Embed and Link. `provider` is what distinguishes them — the
 * model has no separate link kind. See `createEmbed`.
 */
export async function createEmbedAction(
  folderId: string,
  name: string,
  url: string,
  provider: string,
): Promise<string> {
  const me = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("It needs a name.");

  const normalised = normaliseUrl(url);
  if (!normalised) throw new Error("That doesn't look like a URL.");

  const embed = await createEmbed({
    folderId,
    name: trimmed,
    url: normalised,
    provider,
    authorId: me.id,
  });
  revalidatePath("/w/[orgSlug]", "layout");
  return embed.id;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Best-effort — a failed send must never fail the mutation it rides with. */
async function sendInviteEmail(input: {
  to: string;
  personName: string;
  organizationName: string;
  token: string;
}): Promise<void> {
  try {
    const link = `${SITE_URL}/invite/${input.token}`;
    await sendEmail({
      to: input.to,
      subject: `You're invited to ${input.organizationName}`,
      html: `
        <p>Hi ${escapeHtml(input.personName)},</p>
        <p>You've been invited to ${escapeHtml(input.organizationName)}'s workspace.</p>
        <p><a href="${link}">Set your password and get started</a></p>
        <p>This link expires in 7 days.</p>
      `,
    });
  } catch (cause) {
    console.error("Couldn't send invite email:", cause);
  }
}

export async function createClientAction(
  name: string,
  email: string,
  organizationId: string,
  /** Set when the Create panel was opened from inside a folder — links the
   * new client to it in the sidebar. Cosmetic only; access is governed by
   * `organizationId`. */
  folderId?: string,
): Promise<string> {
  const me = await requireAdmin();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) throw new Error("A client needs a name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    throw new Error("That doesn't look like an email address.");
  }
  if (!organizationId) throw new Error("A client needs an organization.");

  const [person, organization] = await Promise.all([
    createClient({
      name: trimmedName,
      email: trimmedEmail,
      organizationId,
      folderId,
    }),
    getOrganization(organizationId),
  ]);

  const invite = await createInvite({
    personId: person.id,
    organizationId,
    email: trimmedEmail,
    invitedByPersonId: me.id,
  });
  await sendInviteEmail({
    to: trimmedEmail,
    personName: trimmedName,
    organizationName: organization?.name ?? "your workspace",
    token: invite.token,
  });

  revalidatePath("/w/[orgSlug]", "layout");
  return person.id;
}

/** "Resend invite" — a fresh token, doesn't touch the client's Person record. */
export async function resendInviteAction(personId: string): Promise<void> {
  const me = await requireAdmin();

  const person = await getPerson(personId);
  if (!person || person.kind !== "client" || !person.organizationId) {
    throw new Error("That client doesn't exist.");
  }

  const [organization, invite] = await Promise.all([
    getOrganization(person.organizationId),
    createInvite({
      personId: person.id,
      organizationId: person.organizationId,
      email: person.email,
      invitedByPersonId: me.id,
    }),
  ]);

  await sendInviteEmail({
    to: person.email,
    personName: person.name,
    organizationName: organization?.name ?? "your workspace",
    token: invite.token,
  });
}

/**
 * Validates the token and marks it used. Does **not** create the Firebase
 * auth user or sign anyone in — the invite-acceptance page does that with
 * the existing `signUp()` client flow, which is the only place that can
 * collect a password. This just closes the loop once that succeeds.
 */
export async function acceptInviteAction(
  token: string,
): Promise<{ organizationSlug: string; personId: string }> {
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error("That invite link isn't valid.");
  if (invite.usedAt) throw new Error("That invite has already been used.");
  if (isInviteExpired(invite)) {
    throw new Error("That invite has expired.");
  }

  const organization = await getOrganization(invite.organizationId);
  if (!organization) throw new Error("That organization no longer exists.");

  await markInviteUsed(invite.id);

  // `after()`, not a plain `await`: this is best-effort side-channel work
  // (see the comment on `sendInviteEmail`) that must never delay routing
  // the newly-signed-up client into their workspace.
  if (invite.invitedByPersonId) {
    const invitedByPersonId = invite.invitedByPersonId;
    after(async () => {
      try {
        const [inviter, client] = await Promise.all([
          getPerson(invitedByPersonId),
          getPerson(invite.personId),
        ]);
        if (inviter && client) {
          await sendEmail({
            to: inviter.email,
            subject: `${client.name} accepted their invite`,
            html: `<p><strong>${escapeHtml(client.name)}</strong> accepted their invite to <strong>${escapeHtml(organization.name)}</strong> and can now sign in.</p>`,
          });

          if (inviter.fcmTokens && inviter.fcmTokens.length > 0) {
            try {
              await adminMessaging().sendEachForMulticast({
                tokens: inviter.fcmTokens,
                notification: {
                  title: "Invite accepted",
                  body: `${client.name} joined ${organization.name}.`,
                },
              });
            } catch (fcmError) {
              console.error("Couldn't send push notification:", fcmError);
            }
          }
        }
      } catch (cause) {
        console.error("Couldn't send invite-accepted notification:", cause);
      }
    });
  }

  return { organizationSlug: organization.slug, personId: invite.personId };
}

export async function registerDeviceTokenAction(token: string): Promise<void> {
  const me = await requireUser();
  await addDeviceToken(me.id, token);
}

/**
 * The client-onboarding step right after password creation — name
 * confirmation and an optional avatar. Authorization is "you are this
 * person": `getCurrentUser()` resolves via the uid↔email adoption that just
 * ran during `signUp()`, so this only succeeds for the account that owns
 * `personId` (or an admin, who might do this on someone's behalf later).
 */
export async function updatePersonProfileAction(
  personId: string,
  input: { name?: string; avatarUrl?: string },
): Promise<void> {
  const me = await requireUser();
  if (me.id !== personId && me.kind !== "member") {
    throw new Error("You can only update your own profile.");
  }

  const trimmedName = input.name?.trim();
  await setPersonProfile(personId, {
    name: trimmedName || undefined,
    avatarUrl: input.avatarUrl,
  });
  revalidatePath("/w/[orgSlug]", "layout");
}

/**
 * Accept what someone actually pastes. A bare `example.com` becomes
 * `https://example.com`; anything that still won't parse, or isn't http(s),
 * is rejected rather than stored as a broken iframe source.
 */
function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/* ---- board cards -------------------------------------------------------- */

export async function createCardAction(input: {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
}): Promise<void> {
  const me = await requireAdmin();

  const title = input.title.trim();
  if (!title) throw new Error("A card needs a title.");

  await createCard({
    ...input,
    title,
    authorId: me.id,
    description: input.description?.trim() || undefined,
  });
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

export async function updateCardAction(input: {
  boardId: string;
  cardId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
}): Promise<void> {
  await requireAdmin();

  const title = input.title.trim();
  if (!title) throw new Error("A card needs a title.");

  await updateCard({
    ...input,
    title,
    description: input.description?.trim() || undefined,
  });
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

export async function moveCardAction(
  boardId: string,
  cardId: string,
  toColumnId: string,
  toIndex?: number,
): Promise<void> {
  await requireAdmin();
  await moveCard({ boardId, cardId, toColumnId, toIndex });
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

export async function deleteCardAction(
  boardId: string,
  cardId: string,
): Promise<void> {
  await requireAdmin();
  await deleteCard({ boardId, cardId });
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

export async function addCardCommentAction(
  boardId: string,
  cardId: string,
  text: string,
): Promise<void> {
  const me = await requireAdmin();

  const trimmed = text.trim();
  if (!trimmed) return;

  await addCardComment({ boardId, cardId, authorId: me.id, text: trimmed });
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

/* ---- boards -------------------------------------------------------------- */

export async function renameBoardAction(
  boardId: string,
  folderId: string,
  name: string,
): Promise<void> {
  await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("A board needs a name.");

  await renameBoard(boardId, trimmed);
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout"); // the sidebar's folder tree shows board names
}

export async function deleteBoardAction(boardId: string, _folderId: string): Promise<void> {
  await requireAdmin();
  await deleteBoard(boardId);
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function setBoardColorAction(
  boardId: string,
  folderId: string,
  color: string,
): Promise<void> {
  await requireAdmin();
  await setBoardColor(boardId, color);
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
  revalidatePath("/w/[orgSlug]", "layout"); // the sidebar tints board rows by colour
}

/* ---- board columns -------------------------------------------------------- */

export async function renameBoardColumnAction(
  boardId: string,
  columnId: string,
  name: string,
): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A list needs a name.");

  await renameBoardColumn(boardId, columnId, trimmed);
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

export async function addBoardColumnAction(
  boardId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A list needs a name.");

  const column = await addBoardColumn(boardId, trimmed);
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
  return { id: column.id, name: column.name };
}

export async function deleteBoardColumnAction(
  boardId: string,
  columnId: string,
): Promise<void> {
  await requireAdmin();
  await deleteBoardColumn(boardId, columnId);
  revalidatePath("/w/[orgSlug]/boards/[boardId]", "page");
}

/* ---- folder / conversation rename & delete -------------------------------- */

export async function renameFolderAction(folderId: string, name: string): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A folder needs a name.");

  await renameFolder(folderId, trimmed);
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function deleteFolderAction(folderId: string): Promise<void> {
  await requireAdmin();
  await deleteFolder(folderId);
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function renameConversationAction(
  conversationId: string,
  folderId: string,
  name: string,
): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A conversation needs a name.");

  await renameConversation(conversationId, trimmed);
  revalidatePath("/w/[orgSlug]/conversations/[conversationId]", "page");
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function deleteConversationAction(
  conversationId: string,
  _folderId: string,
): Promise<void> {
  await requireAdmin();
  await deleteConversation(conversationId);
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout");
}

export async function setFolderColorAction(
  folderId: string,
  color: string,
): Promise<void> {
  await requireAdmin();
  await setFolderColor(folderId, color);
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
  revalidatePath("/w/[orgSlug]", "layout"); // the sidebar tints the folder row too
}

export async function setFolderCoverAction(
  folderId: string,
  url: string,
): Promise<void> {
  await requireAdmin();
  await setFolderCoverUrl(folderId, url);
  revalidatePath("/w/[orgSlug]/folders/[folderId]", "page");
}
