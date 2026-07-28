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
  addBoardColumn,
  addCardComment,
  createBoard,
  createCard,
  createClient,
  createConversation,
  createDocument,
  createEmbed,
  createFolder,
  deleteConversation,
  deleteBoard,
  deleteBoardColumn,
  deleteCard,
  deleteFolder,
  getCurrentUser,
  moveCard,
  renameBoard,
  renameBoardColumn,
  renameConversation,
  renameFolder,
  sendMessage,
  setFolderColor,
  setFolderCoverUrl,
  setBoardColor,
  setTaskCompleted,
  setWorkspaceName,
  updateCard,
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
  /** Set when the Create panel was opened from inside a folder — links the
   * new client to it. Omitted from /clients, which has no folder context. */
  folderId?: string,
): Promise<string> {
  await requireUser();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) throw new Error("A client needs a name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    throw new Error("That doesn't look like an email address.");
  }

  const person = await createClient({
    name: trimmedName,
    email: trimmedEmail,
    folderId,
  });
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
  const me = await requireUser();

  const title = input.title.trim();
  if (!title) throw new Error("A card needs a title.");

  await createCard({
    ...input,
    title,
    authorId: me.id,
    description: input.description?.trim() || undefined,
  });
  revalidatePath(`/boards/${input.boardId}`);
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
  await requireUser();

  const title = input.title.trim();
  if (!title) throw new Error("A card needs a title.");

  await updateCard({
    ...input,
    title,
    description: input.description?.trim() || undefined,
  });
  revalidatePath(`/boards/${input.boardId}`);
}

export async function moveCardAction(
  boardId: string,
  cardId: string,
  toColumnId: string,
  toIndex?: number,
): Promise<void> {
  await requireUser();
  await moveCard({ boardId, cardId, toColumnId, toIndex });
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteCardAction(
  boardId: string,
  cardId: string,
): Promise<void> {
  await requireUser();
  await deleteCard({ boardId, cardId });
  revalidatePath(`/boards/${boardId}`);
}

export async function addCardCommentAction(
  boardId: string,
  cardId: string,
  text: string,
): Promise<void> {
  const me = await requireUser();

  const trimmed = text.trim();
  if (!trimmed) return;

  await addCardComment({ boardId, cardId, authorId: me.id, text: trimmed });
  revalidatePath(`/boards/${boardId}`);
}

/* ---- boards -------------------------------------------------------------- */

export async function renameBoardAction(
  boardId: string,
  folderId: string,
  name: string,
): Promise<void> {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("A board needs a name.");

  await renameBoard(boardId, trimmed);
  revalidatePath(`/boards/${boardId}`);
  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/", "layout"); // the sidebar's folder tree shows board names
}

export async function deleteBoardAction(boardId: string, folderId: string): Promise<void> {
  await requireUser();
  await deleteBoard(boardId);
  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/", "layout");
}

export async function setBoardColorAction(
  boardId: string,
  folderId: string,
  color: string,
): Promise<void> {
  await requireUser();
  await setBoardColor(boardId, color);
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/", "layout"); // the sidebar tints board rows by colour
}

/* ---- board columns -------------------------------------------------------- */

export async function renameBoardColumnAction(
  boardId: string,
  columnId: string,
  name: string,
): Promise<void> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A list needs a name.");

  await renameBoardColumn(boardId, columnId, trimmed);
  revalidatePath(`/boards/${boardId}`);
}

export async function addBoardColumnAction(
  boardId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A list needs a name.");

  const column = await addBoardColumn(boardId, trimmed);
  revalidatePath(`/boards/${boardId}`);
  return { id: column.id, name: column.name };
}

export async function deleteBoardColumnAction(
  boardId: string,
  columnId: string,
): Promise<void> {
  await requireUser();
  await deleteBoardColumn(boardId, columnId);
  revalidatePath(`/boards/${boardId}`);
}

/* ---- folder / conversation rename & delete -------------------------------- */

export async function renameFolderAction(folderId: string, name: string): Promise<void> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A folder needs a name.");

  await renameFolder(folderId, trimmed);
  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/", "layout");
}

export async function deleteFolderAction(folderId: string): Promise<void> {
  await requireUser();
  await deleteFolder(folderId);
  revalidatePath("/", "layout");
}

export async function renameConversationAction(
  conversationId: string,
  folderId: string,
  name: string,
): Promise<void> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A conversation needs a name.");

  await renameConversation(conversationId, trimmed);
  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/", "layout");
}

export async function deleteConversationAction(
  conversationId: string,
  folderId: string,
): Promise<void> {
  await requireUser();
  await deleteConversation(conversationId);
  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/", "layout");
}

export async function setFolderColorAction(
  folderId: string,
  color: string,
): Promise<void> {
  await requireUser();
  await setFolderColor(folderId, color);
  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/", "layout"); // the sidebar tints the folder row too
}

export async function setFolderCoverAction(
  folderId: string,
  url: string,
): Promise<void> {
  await requireUser();
  await setFolderCoverUrl(folderId, url);
  revalidatePath(`/folders/${folderId}`);
}
