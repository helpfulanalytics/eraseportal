/**
 * One function per thing the product emails about.
 *
 * Each owns its subject line, its sender stream and — the part the previous
 * two-`<p>`-tag versions had nothing of — the *context* a recipient needs to
 * act without first opening the app: which client, which folder, which
 * conversation, how big the file was, who did it and when.
 *
 * All of them are best-effort. A failed send must never fail the mutation it
 * rides with: the upload is already in Firestore, the invite row is already
 * written, so a bounced email costs a "Resend" click, not a broken account.
 * Every export therefore swallows its own errors rather than making six call
 * sites remember to.
 */
import { formatBytes } from "../kitchen-format";
import { PRODUCT_NAME, PRODUCT_SHORT } from "./brand";
import { SITE_URL, sendEmail, type SendInput } from "./resend";
import type { EmailFact } from "./layout";

/**
 * A finished message minus its recipient.
 *
 * Each template is split into a pure `build*` that returns one of these and a
 * `send*` that hands it to the transport, for two reasons. Building is the
 * part worth looking at without sending anything — `/api/email/preview`
 * renders these straight to the browser — and a fan-out (an upload notifies
 * every member) builds once and sends N times instead of re-deriving the same
 * body per recipient.
 */
export type EmailDraft = Omit<SendInput, "to">;

/**
 * "Aug 21, 2026, 4:45 PM UTC".
 *
 * UTC with the zone spelled out, unlike `formatDateTime` in `kitchen-format`.
 * That one renders in the *reader's* timezone because it runs in the reader's
 * browser; this one runs on a server whose timezone has nothing to do with
 * either party, so an unlabelled local time would just be quietly wrong.
 */
function timestamp(iso = new Date().toISOString()): string {
  return `${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

/**
 * "Aug 28, 2026" — a due date, which is a bare calendar date with no instant
 * behind it. Read in UTC so it doesn't slide back a day for readers west of
 * Greenwich, matching `formatShortDate` in `kitchen-format` rather than
 * `timestamp` above.
 */
function dueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One line, trimmed to a word boundary. For subjects and preheaders, where a
 * cut mid-word reads as broken and a newline would be dropped anyway.
 */
function excerpt(text: string, max = 140): string {
  return truncate(text.replace(/\s+/g, " ").trim(), max);
}

/**
 * Same cap, but paragraph breaks survive. The quote block renders with
 * `white-space: pre-wrap`, so flattening a two-paragraph message into one run
 * would throw away structure its author put there deliberately.
 */
function clamp(text: string, max: number): string {
  return truncate(
    text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim(),
    max,
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return `${cut.slice(0, lastBreak > max * 0.6 ? lastBreak : max).trimEnd()}…`;
}

/** Drops the rows whose value never materialised, so no "Folder: undefined". */
function facts(rows: Array<EmailFact | null | undefined>): EmailFact[] {
  return rows.filter((row): row is EmailFact => Boolean(row?.value));
}

/** The workspace settings page, when we know which workspace. */
function settingsUrl(orgSlug?: string): string | undefined {
  return orgSlug ? `${SITE_URL}/w/${orgSlug}/settings` : undefined;
}

/* ---- invites --------------------------------------------------------- */

export interface InviteInput {
  to: string;
  personName: string;
  /** The organization's name for a client, the workspace's for a member. */
  destinationName: string;
  token: string;
  /** Changes the wording — a member is joining the team, not a client portal. */
  audience: "member" | "client";
  /** Who sent the invite. Fronts the subject and the sender name when known. */
  invitedByName?: string;
}

export function buildInviteEmail(input: InviteInput): EmailDraft {
  const link = `${SITE_URL}/invite/${input.token}`;
  const isMember = input.audience === "member";
  const inviter = input.invitedByName?.trim();
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();

  return {
    subject: inviter
      ? `${inviter} invited you to ${input.destinationName}`
      : `You're invited to ${input.destinationName}`,
    stream: "invites",
    type: isMember ? "invite-member" : "invite-client",
    actorName: inviter,
    content: {
      eyebrow: "Invitation",
      headline: isMember
        ? `Join the ${input.destinationName} team`
        : `Your ${input.destinationName} workspace is ready`,
      preheader: `Set a password to open ${input.destinationName} — the link is good for 7 days.`,
      intro: [
        `Hi ${input.personName},`,
        isMember
          ? `${inviter ? `${inviter} has invited you` : "You've been invited"} to join ${input.destinationName} on ${PRODUCT_NAME}, where the team runs client folders, files, conversations and tasks in one place.`
          : `${inviter ? `${inviter} has set up` : "We've set up"} a private workspace for ${input.destinationName} on ${PRODUCT_NAME}. It's where you'll find shared files, project folders, conversations with the team, and anything that needs your sign-off.`,
        "Setting a password takes about a minute, and you won't have to do it again.",
      ],
      facts: facts([
        { label: isMember ? "Workspace" : "Organization", value: input.destinationName },
        inviter ? { label: "Invited by", value: inviter } : null,
        { label: "Your role", value: isMember ? "Team member" : "Client" },
        { label: "Sign in as", value: input.to },
        { label: "Invitation expires", value: timestamp(expires) },
      ]),
      cta: { label: "Set your password", href: link },
      note: "This link works once and expires in 7 days. If it's lapsed, ask for a fresh invite — nothing is lost.",
      reason: inviter
        ? `You're receiving this because ${inviter} invited you to ${input.destinationName}.`
        : `You're receiving this because you were invited to ${input.destinationName}.`,
    },
  };
}

export async function sendInviteEmail(input: InviteInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildInviteEmail(input) });
  } catch (cause) {
    console.error("Couldn't send invite email:", cause);
  }
}

export interface InviteAcceptedInput {
  /** The inviter — this mail goes back to whoever sent the invitation. */
  to: string;
  inviterName: string;
  inviteeName: string;
  inviteeEmail: string;
  /** Organization name for a client, workspace name for a member. */
  joinedName: string;
  /** Where the inviter can see them: the team page, or the client's org. */
  destinationUrl?: string;
}

export function buildInviteAcceptedEmail(input: InviteAcceptedInput): EmailDraft {
  return {
    subject: `${input.inviteeName} accepted your invite to ${input.joinedName}`,
    stream: "invites",
    type: "invite-accepted",
    content: {
      accent: "green",
      eyebrow: "Invitation accepted",
      headline: `${input.inviteeName} joined ${input.joinedName}`,
      preheader: `${input.inviteeName} (${input.inviteeEmail}) set a password and can now sign in.`,
      intro: [
        `Hi ${input.inviterName},`,
        `${input.inviteeName} accepted the invitation you sent and can now sign in to ${input.joinedName}. Nothing further is needed from you.`,
      ],
      facts: facts([
        { label: "Name", value: input.inviteeName },
        { label: "Email", value: input.inviteeEmail },
        { label: "Joined", value: input.joinedName },
        { label: "Accepted", value: timestamp() },
      ]),
      cta: input.destinationUrl
        ? { label: "View in the portal", href: input.destinationUrl }
        : undefined,
      reason: `You're receiving this because you invited ${input.inviteeName} to ${input.joinedName}.`,
    },
  };
}

export async function sendInviteAcceptedEmail(input: InviteAcceptedInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildInviteAcceptedEmail(input) });
  } catch (cause) {
    console.error("Couldn't send invite-accepted email:", cause);
  }
}

/* ---- conversations --------------------------------------------------- */

export interface NewMessageInput {
  to: string;
  authorName: string;
  conversationId: string;
  conversationName: string;
  body: string;
  attachmentCount: number;
  folderName?: string;
  organizationName?: string;
  orgSlug?: string;
  conversationUrl: string;
}

export function buildNewMessageEmail(input: NewMessageInput): EmailDraft {
  const attachmentNote =
    input.attachmentCount > 0
      ? `${input.attachmentCount} file${input.attachmentCount === 1 ? "" : "s"}`
      : undefined;

  return {
    // Not "${author} sent a message" — the From line already says who, so the
    // subject spends its width on where instead.
    subject: `New message in ${input.conversationName}`,
    stream: "messages",
    type: "message-new",
    actorName: input.authorName,
    // Every message in one conversation threads together rather than stacking
    // up as separate inbox items under an identical subject.
    threadKey: input.conversationId,
    content: {
      eyebrow: "New message",
      headline: `${input.authorName} posted in ${input.conversationName}`,
      preheader:
        excerpt(input.body) ||
        `${input.authorName} shared ${attachmentNote ?? "a file"} in ${input.conversationName}.`,
      quote: input.body
        ? { author: input.authorName, body: clamp(input.body, 600) }
        : undefined,
      intro: input.body
        ? undefined
        : [`${input.authorName} shared ${attachmentNote ?? "a file"} — open the conversation to see it.`],
      facts: facts([
        { label: "Conversation", value: input.conversationName },
        input.folderName ? { label: "Folder", value: input.folderName } : null,
        input.organizationName ? { label: "Client", value: input.organizationName } : null,
        attachmentNote ? { label: "Attached", value: attachmentNote } : null,
        { label: "Sent", value: timestamp() },
      ]),
      cta: { label: "Reply in the portal", href: input.conversationUrl },
      reason: `You're receiving this because you're a participant in ${input.conversationName}.`,
      settingsUrl: settingsUrl(input.orgSlug),
    },
  };
}

export async function sendNewMessageEmail(input: NewMessageInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildNewMessageEmail(input) });
  } catch (cause) {
    console.error("Couldn't send new-message email:", cause);
  }
}

/* ---- files ----------------------------------------------------------- */

export interface FileUploadedInput {
  to: string;
  uploaderName: string;
  fileName: string;
  /** Absent on paths that don't know the size — the row is simply dropped. */
  bytes?: number;
  folderId: string;
  folderName: string;
  organizationName?: string;
  orgSlug?: string;
  folderUrl: string;
}

export function buildFileUploadedEmail(input: FileUploadedInput): EmailDraft {
  const extension = input.fileName.includes(".")
    ? input.fileName.split(".").pop()?.toUpperCase().slice(0, 5)
    : undefined;

  return {
    subject: `${input.fileName} was added to ${input.folderName}`,
    stream: "files",
    type: "file-uploaded",
    actorName: input.uploaderName,
    // Uploads into one folder thread together — a client dropping twelve
    // photos should be one item in the inbox, not twelve.
    threadKey: input.folderId,
    content: {
      eyebrow: "New file",
      headline: `${input.uploaderName} added a file to ${input.folderName}`,
      preheader: `${input.fileName}${input.bytes ? ` · ${formatBytes(input.bytes)}` : ""} — in ${input.folderName}${input.organizationName ? ` (${input.organizationName})` : ""}.`,
      facts: facts([
        { label: "File", value: input.fileName },
        extension ? { label: "Type", value: extension } : null,
        input.bytes ? { label: "Size", value: formatBytes(input.bytes) } : null,
        { label: "Folder", value: input.folderName },
        input.organizationName ? { label: "Client", value: input.organizationName } : null,
        { label: "Added by", value: input.uploaderName },
        { label: "Uploaded", value: timestamp() },
      ]),
      cta: { label: "Open the folder", href: input.folderUrl },
      reason: `You're receiving this because you're on the ${PRODUCT_SHORT} team and have access to ${input.folderName}.`,
      settingsUrl: settingsUrl(input.orgSlug),
    },
  };
}

export async function sendFileUploadedEmail(input: FileUploadedInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildFileUploadedEmail(input) });
  } catch (cause) {
    console.error("Couldn't send file-uploaded email:", cause);
  }
}

/* ---- tasks ----------------------------------------------------------- */

export interface TaskAssignedInput {
  to: string;
  assignerName: string;
  taskId: string;
  taskTitle: string;
  /** Bare calendar date, `YYYY-MM-DD` — rendered as a date, never an instant. */
  dueDate?: string;
  folderName?: string;
  organizationName?: string;
  orgSlug?: string;
  tasksUrl: string;
}

export function buildTaskAssignedEmail(input: TaskAssignedInput): EmailDraft {
  return {
    subject: `New task: ${excerpt(input.taskTitle, 70)}`,
    stream: "tasks",
    type: "task-assigned",
    actorName: input.assignerName,
    threadKey: input.taskId,
    content: {
      eyebrow: "Task assigned",
      headline: `${input.assignerName} assigned you a task`,
      preheader: `${excerpt(input.taskTitle, 100)}${input.dueDate ? ` — due ${input.dueDate}` : ""}`,
      quote: { author: "Task", body: input.taskTitle },
      facts: facts([
        { label: "Assigned by", value: input.assignerName },
        input.dueDate ? { label: "Due", value: dueDate(input.dueDate) } : null,
        input.folderName ? { label: "Folder", value: input.folderName } : null,
        input.organizationName ? { label: "Client", value: input.organizationName } : null,
        { label: "Created", value: timestamp() },
      ]),
      cta: { label: "Open your tasks", href: input.tasksUrl },
      reason: `You're receiving this because ${input.assignerName} assigned this task to you.`,
      settingsUrl: settingsUrl(input.orgSlug),
    },
  };
}

export async function sendTaskAssignedEmail(input: TaskAssignedInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildTaskAssignedEmail(input) });
  } catch (cause) {
    console.error("Couldn't send task-assigned email:", cause);
  }
}

export interface TaskCompletedInput {
  to: string;
  completerName: string;
  taskId: string;
  taskTitle: string;
  folderName?: string;
  organizationName?: string;
  orgSlug?: string;
  tasksUrl: string;
}

export function buildTaskCompletedEmail(input: TaskCompletedInput): EmailDraft {
  return {
    subject: `Completed: ${excerpt(input.taskTitle, 70)}`,
    stream: "tasks",
    type: "task-completed",
    actorName: input.completerName,
    threadKey: input.taskId,
    content: {
      accent: "green",
      eyebrow: "Task completed",
      headline: `${input.completerName} marked your task as done`,
      preheader: `${excerpt(input.taskTitle, 100)} — completed by ${input.completerName}.`,
      quote: { author: "Task", body: input.taskTitle },
      facts: facts([
        { label: "Completed by", value: input.completerName },
        input.folderName ? { label: "Folder", value: input.folderName } : null,
        input.organizationName ? { label: "Client", value: input.organizationName } : null,
        { label: "Completed", value: timestamp() },
      ]),
      cta: { label: "View tasks", href: input.tasksUrl },
      reason: "You're receiving this because you created this task.",
      settingsUrl: settingsUrl(input.orgSlug),
    },
  };
}

export async function sendTaskCompletedEmail(input: TaskCompletedInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildTaskCompletedEmail(input) });
  } catch (cause) {
    console.error("Couldn't send task-completed email:", cause);
  }
}

/* ---- boards ------------------------------------------------------------ */

export interface CardAddedInput {
  to: string;
  authorName: string;
  cardId: string;
  cardTitle: string;
  boardName: string;
  folderName?: string;
  organizationName?: string;
  orgSlug?: string;
  boardUrl: string;
}

/**
 * A board card has no participant/watcher list of its own (unlike a
 * Conversation), so this rides the `tasks` stream rather than a new one — a
 * card is the closest thing this product already emails about, and adding a
 * fifth stream means a new sender address to provision in `docs/email.md`
 * for one notification.
 */
export function buildCardAddedEmail(input: CardAddedInput): EmailDraft {
  return {
    subject: `${input.authorName} added a card to ${input.boardName}`,
    stream: "tasks",
    type: "card-added",
    actorName: input.authorName,
    // Cards added to the same board thread together in the inbox.
    threadKey: input.cardId,
    content: {
      eyebrow: "New card",
      headline: `${input.authorName} added a card to ${input.boardName}`,
      preheader: excerpt(input.cardTitle, 140),
      quote: { author: "Card", body: input.cardTitle },
      facts: facts([
        { label: "Board", value: input.boardName },
        input.folderName ? { label: "Folder", value: input.folderName } : null,
        input.organizationName ? { label: "Client", value: input.organizationName } : null,
        { label: "Added by", value: input.authorName },
        { label: "Added", value: timestamp() },
      ]),
      cta: { label: "Open the board", href: input.boardUrl },
      reason: `You're receiving this because you're on the ${PRODUCT_SHORT} team and have access to ${input.boardName}.`,
      settingsUrl: settingsUrl(input.orgSlug),
    },
  };
}

export async function sendCardAddedEmail(input: CardAddedInput): Promise<void> {
  try {
    await sendEmail({ to: input.to, ...buildCardAddedEmail(input) });
  } catch (cause) {
    console.error("Couldn't send card-added email:", cause);
  }
}
