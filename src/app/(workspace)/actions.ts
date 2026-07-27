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
  createConversation,
  createFolder,
  getCurrentUser,
  sendMessage,
  setTaskCompleted,
  setWorkspaceName,
} from "@/lib/kitchen-data";

/** Every mutation needs an identity; none of them accept one as input. */
async function requireUser() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");
  return me;
}

export async function createFolderAction(name: string): Promise<string> {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("A folder needs a name.");

  const folder = await createFolder(trimmed);

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
