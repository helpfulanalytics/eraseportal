"use server";

/**
 * Workspace-wide mutations.
 *
 * Server actions are public HTTP endpoints, so every one of these takes the
 * acting user from the session rather than from its arguments. A caller can
 * choose *what* to write; it never gets to choose *who* wrote it.
 *
 * Folder-scoped file uploads live in `folders/[folderId]/actions.ts` instead,
 * because they're coupled to that route's Storage prefix.
 */
import { revalidatePath } from "next/cache";
import {
  createBoard,
  createClient,
  createConversation,
  createDocument,
  createEmbed,
  createFolder,
  getCurrentUser,
  sendMessage,
  setTaskCompleted,
  setWorkspaceName,
} from "@/lib/kitchen-data";
import type { FolderAccess } from "@/lib/kitchen-types";

/** Every mutation needs an identity; none of them accept one as input. */
async function requireUser() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");
  return me;
}

export async function createFolderAction(input: {
  name: string;
  description?: string;
  access?: FolderAccess;
  internalRole?: "viewer" | "editor";
}): Promise<string> {
  await requireUser();

  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("A folder needs a name.");

  const folder = await createFolder({
    ...input,
    name: trimmed,
    description: input.description?.trim() || undefined,
  });

  // The sidebar's folder tree is built in the workspace layout, so the whole
  // segment has to re-render — not just the page that triggered this.
  revalidatePath("/", "layout");
  return folder.id;
}

export async function createConversationAction(
  folderId: string,
  name: string,
): Promise<string> {
  const me = await requireUser();

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

  revalidatePath("/", "layout");
  return conversation.id;
}

export async function sendMessageAction(
  conversationId: string,
  text: string,
  isNote: boolean,
): Promise<void> {
  const me = await requireUser();

  const trimmed = text.trim();
  if (!trimmed) return;

  await sendMessage({
    conversationId,
    authorId: me.id,
    text: trimmed,
    isNote,
  });

  revalidatePath(`/conversations/${conversationId}`);
  // The folder listing shows a message count for the conversation.
  revalidatePath("/", "layout");
}

export async function toggleTaskAction(
  taskId: string,
  completed: boolean,
): Promise<void> {
  await requireUser();
  await setTaskCompleted(taskId, completed);

  revalidatePath("/tasks");
  revalidatePath("/tasks/me");
}

export async function renameWorkspaceAction(name: string): Promise<void> {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("The workspace needs a name.");

  await setWorkspaceName(trimmed);
  revalidatePath("/", "layout");
}

/* ---- folder contents -------------------------------------------------- */

export async function createBoardAction(
  folderId: string,
  name: string,
): Promise<string> {
  const me = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A board needs a name.");

  const board = await createBoard({ folderId, name: trimmed, authorId: me.id });
  revalidatePath("/", "layout");
  return board.id;
}

export async function createDocumentAction(
  folderId: string,
  name: string,
): Promise<string> {
  const me = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A document needs a name.");

  const doc = await createDocument({ folderId, name: trimmed, authorId: me.id });
  revalidatePath("/", "layout");
  return doc.id;
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
  const me = await requireUser();
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
  revalidatePath("/", "layout");
  return embed.id;
}

export async function createClientAction(
  name: string,
  email: string,
): Promise<string> {
  await requireUser();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) throw new Error("A client needs a name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    throw new Error("That doesn't look like an email address.");
  }

  const person = await createClient({ name: trimmedName, email: trimmedEmail });
  revalidatePath("/", "layout");
  return person.id;
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
