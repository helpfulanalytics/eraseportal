/**
 * WhatsApp mirror of `email/templates.ts` — one function per thing the
 * product notifies about, reusing the same input types email already
 * defines. Plain text instead of an `EmailDraft`; no layout, no subject line.
 *
 * Same rules as the email versions: best-effort, never throws, no-ops
 * immediately when Twilio isn't configured so a clone with no credentials
 * behaves identically to one where every recipient simply lacks a phone
 * number.
 */
import { SITE_URL } from "../email/resend";
import type {
  FileUploadedInput,
  InviteAcceptedInput,
  InviteInput,
  NewMessageInput,
  TaskAssignedInput,
  TaskCompletedInput,
} from "../email/templates";
import { isWhatsAppConfigured, sendWhatsApp } from "./twilio";

async function send(label: string, to: string, body: string): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  try {
    await sendWhatsApp(to, body);
  } catch (cause) {
    console.error(`Couldn't send ${label} WhatsApp message:`, cause);
  }
}

export async function sendInviteWhatsapp(
  input: InviteInput & { to: string },
): Promise<void> {
  const link = `${SITE_URL}/invite/${input.token}`;
  const inviter = input.invitedByName?.trim();
  const body =
    (inviter
      ? `${inviter} invited you to ${input.destinationName} on ${input.audience === "member" ? "the team" : "your client portal"}.`
      : `You're invited to ${input.destinationName}.`) +
    `\nSet your password: ${link}\n(Link expires in 7 days.)`;
  await send("invite", input.to, body);
}

export async function sendInviteAcceptedWhatsapp(
  input: InviteAcceptedInput & { to: string },
): Promise<void> {
  const body = `${input.inviteeName} accepted your invite to ${input.joinedName} and can now sign in.`;
  await send("invite-accepted", input.to, body);
}

export async function sendNewMessageWhatsapp(
  input: NewMessageInput & { to: string },
): Promise<void> {
  const body = `${input.authorName} posted in ${input.conversationName}${input.folderName ? ` (${input.folderName})` : ""}:\n${input.body || "(shared a file)"}\n${input.conversationUrl}`;
  await send("new-message", input.to, body);
}

export async function sendFileUploadedWhatsapp(
  input: FileUploadedInput & { to: string },
): Promise<void> {
  const body = `${input.uploaderName} added ${input.fileName} to ${input.folderName}${input.organizationName ? ` (${input.organizationName})` : ""}.\n${input.folderUrl}`;
  await send("file-uploaded", input.to, body);
}

export async function sendTaskAssignedWhatsapp(
  input: TaskAssignedInput & { to: string },
): Promise<void> {
  const body = `${input.assignerName} assigned you a task: ${input.taskTitle}${input.dueDate ? ` (due ${input.dueDate})` : ""}.\n${input.tasksUrl}`;
  await send("task-assigned", input.to, body);
}

export async function sendTaskCompletedWhatsapp(
  input: TaskCompletedInput & { to: string },
): Promise<void> {
  const body = `${input.completerName} marked your task as done: ${input.taskTitle}.\n${input.tasksUrl}`;
  await send("task-completed", input.to, body);
}
