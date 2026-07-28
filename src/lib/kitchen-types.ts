/**
 * Domain model for the workspace.
 *
 * Shapes mirror the object model in docs/kitchen-scan.md §1 and reuse the same
 * opaque ID prefixes (`fo_`, `convr_`, `msg_`) so URLs are interchangeable with
 * the app this replaces.
 *
 * Types only — no data, no I/O, no `firebase-admin`. That keeps this file
 * importable from client components, which `kitchen-data.ts` deliberately is
 * not. Firestore documents are stored in exactly these shapes minus the `id`,
 * which lives in the document key; see `kitchen-data.ts` for the mapping.
 */

export type ItemKind =
  | "conversation"
  | "board"
  | "document"
  | "embed"
  | "file";

export interface Workspace {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  /** Display handle used by @mentions. */
  handle: string;
  email: string;
  initials: string;
  /** Tint for the avatar fallback. */
  color: string;
  kind: "member" | "client";
  /**
   * Firebase Auth uid, once this person has signed in at least once. Absent
   * for people who exist in the workspace but have never authenticated —
   * seeded clients, mostly. Links a session back to a domain Person.
   */
  uid?: string;
}

/**
 * Folder visibility, as offered by the Create Folder dialog.
 *
 * **Stored, not enforced.** Nothing in the read path consults this yet —
 * `getFolders` returns every folder to every signed-in user. Treat it as a
 * recorded intention until access control exists, and don't rely on
 * `private` to hide anything. Same caveat as `Message.isNote`.
 */
export type FolderAccess = "private" | "clients" | "internal";

export interface Folder {
  id: string;
  name: string;
  /** Full-bleed cover artwork above the folder header. */
  coverUrl?: string;
  /** Optional link rendered as the subtitle under the folder title. */
  url?: string;
  description?: string;
  starred: boolean;
  itemIds: string[];
  /** Absent on folders seeded before the dialog existed. */
  access?: FolderAccess;
  /** Only meaningful when `access` is `internal`. */
  internalRole?: "viewer" | "editor";
}

/** Metadata varies by kind — conversations count messages, files carry bytes. */
export type ItemMeta =
  | { type: "conversation"; messageCount: number }
  | { type: "file"; mime: string; label: string; bytes: number }
  | { type: "board"; cardCount: number }
  | { type: "document"; updatedAt: string }
  | { type: "embed"; provider: string }
  | { type: "plain" };

export interface FolderItem {
  id: string;
  kind: ItemKind;
  name: string;
  folderId: string;
  /** ISO date; formatted at render so the mock doesn't bake in a locale. */
  createdAt: string;
  authorId: string;
  meta: ItemMeta;
}

/* ---- message content ------------------------------------------------ */

/**
 * Message bodies are structured rather than strings. Real messages carry bold
 * runs, bullet lists, @mention pills and autolinked URLs; modelling them as
 * nodes renders all of that without a rich-text engine, and leaves room for a
 * real editor to produce the same shape later.
 */
export type Inline =
  | { t: "text"; v: string; bold?: boolean; italic?: boolean }
  | { t: "mention"; personId: string }
  | { t: "link"; href: string; v?: string };

export type Block =
  | { b: "p"; children: Inline[] }
  /**
   * List items are `{ children }` objects rather than bare `Inline[]`, which
   * would be the more obvious modelling. Firestore rejects an array directly
   * inside an array — "Property array contains an invalid nested entity" — so
   * `Inline[][]` cannot be stored at all. Wrapping each item in a map also
   * makes the shape match the `p` block above.
   */
  | { b: "ul"; items: Array<{ children: Inline[] }> }
  | { b: "code"; lang?: string; v: string };

export interface Reaction {
  emoji: string;
  personIds: string[];
}

export interface Attachment {
  id: string;
  name: string;
  label: string;
  bytes: number;
}

export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  createdAt: string;
  body: Block[];
  reactions?: Reaction[];
  attachments?: Attachment[];
  /** Internal note — visible to the team, not the client. */
  isNote?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  folderId: string;
  participantIds: string[];
  starred: boolean;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate?: string;
  assigneeId?: string;
  folderId?: string;
  completed: boolean;
}

/* ---- board / document / embed --------------------------------------- */

/**
 * NOTE: no Board existed in the workspace that was scanned, so this shape is
 * inferred from the "Track projects" description rather than observed. Treat
 * the column/card model as a design decision, not a faithful port.
 */
export interface BoardCard {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
}

export interface BoardColumn {
  id: string;
  name: string;
  cards: BoardCard[];
}

export interface Board {
  id: string;
  name: string;
  folderId: string;
  columns: BoardColumn[];
}

export interface KDocument {
  id: string;
  name: string;
  folderId: string;
  authorId: string;
  updatedAt: string;
  blocks: Block[];
}

export interface Embed {
  id: string;
  name: string;
  folderId: string;
  url: string;
  provider: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  clientIds: string[];
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  /** What a folder created from this template starts with. */
  contents: string[];
}

export type InboxKind = "chat" | "task" | "file" | "update";

export interface InboxEntry {
  id: string;
  kind: InboxKind;
  authorId: string;
  createdAt: string;
  /** Rendered italic when true — system lines like "Mentioned you in …". */
  system?: boolean;
  preview: string;
  breadcrumb: string[];
  href: string;
}

/* ---- derived views --------------------------------------------------- */

/**
 * A file as the Library lists it, flattening the two places files come from:
 * items uploaded into a folder, and attachments on a message.
 */
export interface LibraryFile {
  id: string;
  name: string;
  label: string;
  bytes: number;
  createdAt: string;
  authorId: string;
  folderId: string;
  /** Folder name for an upload, conversation name for an attachment. */
  source: string;
}

/** An attachment plus the message context the Files tab shows alongside it. */
export type ConversationFile = Attachment & {
  messageId: string;
  createdAt: string;
  authorId: string;
};

/**
 * The sidebar's folder tree. A projection rather than the full `Folder`: the
 * nav renders on every route, so it carries only what it draws.
 */
export interface NavFolder {
  id: string;
  name: string;
  conversations: Array<{ id: string; name: string }>;
  boards: Array<{ id: string; name: string }>;
}
