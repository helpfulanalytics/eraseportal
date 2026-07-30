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
  /** Set during onboarding (client invite) or absent — falls back to initials. */
  avatarUrl?: string;
  kind: "member" | "client";
  /**
   * Firebase Auth uid, once this person has signed in at least once. Absent
   * for people who exist in the workspace but have never authenticated —
   * seeded clients, mostly. Links a session back to a domain Person.
   */
  uid?: string;
  /**
   * The tenant this client belongs to — only meaningful when `kind` is
   * `"client"`. This is the access boundary: a client can only reach folders
   * whose `organizationId` matches this. Members have no `organizationId`
   * and see every organization.
   */
  organizationId?: string;
  /**
   * The one folder this client is associated with, if any — cosmetic only
   * (shows the client under that folder in the sidebar tree). Access is
   * governed by `organizationId`, not this field; a client can see every
   * folder in their organization, not just this one.
   */
  folderId?: string;
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
  /** One of `SWATCH_COLORS` in kitchen-format.ts. Absent on older folders. */
  color?: string;
  /**
   * The organization (client business) this folder belongs to, if any.
   * Absent means agency-internal — no client can ever see it, regardless of
   * `access`. This is the actual, enforced access boundary; `access`/
   * `internalRole` above are still unenforced (see their doc comments).
   */
  organizationId?: string;
}

/** Metadata varies by kind — conversations count messages, files carry bytes. */
export type ItemMeta =
  | { type: "conversation"; messageCount: number }
  /**
   * `url` is the Storage download URL. It has always been *written* (see
   * `createFolderFile`, which put it at the top level of the item document
   * because this type predated Storage) and never read; it's here now so an
   * upload can actually be opened. `getFolderItems` lifts the old top-level
   * field into this one, so files uploaded before this existed still work.
   */
  | { type: "file"; mime: string; label: string; bytes: number; url?: string }
  | { type: "board"; cardCount: number }
  /**
   * `docKind` is denormalised off the document so the folder listing and the
   * sidebar can draw a canvas differently from a page without reading the
   * document itself. Absent on documents created before canvases existed —
   * treat that as `"page"`, same as `KDocument.docKind`.
   *
   * `preview` is the document's own first line, written on every save. The
   * alternative — reading every document to render one folder — is a query
   * per row for a subtitle.
   */
  | {
      type: "document";
      updatedAt: string;
      docKind?: DocumentKind;
      preview?: string;
    }
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
  /** Short kind for the metadata line — "PDF", "PNG", "Audio". */
  label: string;
  bytes: number;
  /**
   * Storage download URL. Absent on seeded attachments, which were fixtures
   * with no bytes behind them — an attachment without one renders as a chip
   * you can read but not open.
   */
  url?: string;
  /** Drives inline rendering: images preview, audio gets a player. */
  mime?: string;
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
  /** Who created it — absent on tasks seeded before creation was tracked. */
  authorId?: string;
}

/* ---- board / document / embed --------------------------------------- */

/**
 * NOTE: no Board existed in the workspace that was scanned, so this shape is
 * inferred from the "Track projects" description rather than observed. Treat
 * the column/card model as a design decision, not a faithful port.
 */
export interface BoardCardComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface BoardCard {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
  /** Absent on cards created before authorship was tracked. */
  authorId?: string;
  createdAt?: string;
  comments?: BoardCardComment[];
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
  /** One of `SWATCH_COLORS` in kitchen-format.ts. Absent on older boards. */
  color?: string;
  /** Absent on anything created before the star was wired up — read as false. */
  starred?: boolean;
}

/**
 * What a document *is*, chosen at creation time and never changed afterwards.
 *
 * - `page` — a Notion-style stack of blocks, stored in `content`.
 * - `canvas` — a Miro-style infinite whiteboard, stored in `nodes`.
 *
 * Deliberately not the same axis as `ItemKind`: both are `kind: "document"`
 * to the folder listing, the sidebar and `itemHref`, because both live at
 * `/documents/{id}` and both are "a thing someone writes in". Only the
 * editor differs. A canvas is *not* the kanban `Board` above — that one is
 * columns and cards and has its own collection and route.
 */
export type DocumentKind = "page" | "canvas";

/**
 * A block in a page document.
 *
 * `html` is an inline-formatting fragment — `<b>`, `<i>`, `<u>`, `<s>`,
 * `<code>`, `<a href>`, `<br>` and text, nothing else. It comes out of a
 * `contenteditable`, so it is attacker-controlled by definition and is
 * re-sanitized server-side on every save (`sanitizeInlineHtml` in
 * `doc-blocks.ts`) — never render it with `dangerouslySetInnerHTML` without
 * passing it through that first.
 *
 * Nesting is deliberately absent: a list item is a block with
 * `type: "bullet"`, not a child of a list block. Firestore can't store an
 * array inside an array (see the `ul` note above), and a flat array with an
 * indent level is the shape that survives that constraint.
 */
export type DocBlockType =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "todo"
  | "quote"
  | "code"
  | "divider";

export interface DocBlock {
  id: string;
  type: DocBlockType;
  /** Sanitized inline HTML. Empty string for a divider. */
  html: string;
  /** Only meaningful for `type: "todo"`. */
  checked?: boolean;
}

/** Sticky notes, shapes, text and connectors — everything a canvas holds. */
export type CanvasNodeKind = "note" | "text" | "rect" | "ellipse" | "arrow";

/**
 * One object on a canvas, positioned in world coordinates (unaffected by
 * pan/zoom, which live only in the client's camera).
 *
 * For an arrow, `x,y` is the tail and `x+w, y+h` the head, so `w`/`h` may be
 * negative; every other kind keeps a normalised rect with positive size.
 * Array order is z-order, back to front.
 */
export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Plain text — canvas text isn't rich, unlike a page block's `html`. */
  text?: string;
  /** A key into `CANVAS_COLORS` in `canvas.ts`, not a raw colour value. */
  color: string;
}

export interface KDocument {
  id: string;
  name: string;
  folderId: string;
  authorId: string;
  updatedAt: string;
  /**
   * Absent on documents created before canvases existed; read it through
   * `documentKind()` in `doc-blocks.ts`, which defaults it to `"page"`.
   */
  docKind?: DocumentKind;
  /**
   * The editable body of a page document. Absent on documents that have
   * never been opened in the editor — `docBlocksOf()` falls back to
   * converting the legacy `blocks` below.
   */
  content?: DocBlock[];
  /** The body of a canvas document. Absent until something is drawn. */
  nodes?: CanvasNode[];
  /** Absent on anything created before the star was wired up — read as false. */
  starred?: boolean;
  /**
   * The original read-only body, in the same shape as a message. Seeded
   * documents have only this; the editor migrates it into `content` on first
   * save and never writes it again. Kept rather than dropped so an old
   * document isn't destroyed by a deploy.
   */
  blocks: Block[];
}

export interface Embed {
  id: string;
  name: string;
  folderId: string;
  url: string;
  provider: string;
  /** Absent on anything created before the star was wired up — read as false. */
  starred?: boolean;
}

/**
 * A client business — the tenant boundary. Every `Folder` and `Person` of
 * `kind: "client"` optionally carries an `organizationId` pointing here;
 * admins (`kind: "member"`) aren't scoped to one and see every org.
 */
export interface Organization {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  /** URL path segment for this org's workspace portal — `/w/{slug}`. */
  slug: string;
}

/**
 * A tokenized invite for a client to set a password and claim their
 * pre-seeded `Person` record. `personId` and `organizationId` are denormalised
 * off the `Person` at creation time so accepting an invite doesn't need a
 * second read.
 */
export interface Invite {
  id: string;
  token: string;
  personId: string;
  organizationId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
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
 * A message as the Inbox lists it — the message plus the conversation and
 * folder it arrived in, which is what the row actually renders.
 *
 * Denormalised at read time rather than stored: the Inbox is a view over
 * `messages`, not a collection of its own. The seeded `inbox` collection and
 * `InboxEntry` below are the older, static version of the same idea — that
 * one is a fixture, this one is what actually happened.
 */
export interface InboxMessage {
  id: string;
  conversationId: string;
  conversationName: string;
  folderId: string;
  folderName: string;
  authorId: string;
  createdAt: string;
  /** First line of the body, flattened out of `Block[]`. */
  preview: string;
  attachmentCount: number;
  /** Internal note — shown with the same marker the message list uses. */
  isNote?: boolean;
}

/** A folder item as the Inbox's Updates tab lists it: "X added <name>". */
export interface InboxActivity {
  id: string;
  kind: ItemKind;
  name: string;
  folderId: string;
  folderName: string;
  authorId: string;
  createdAt: string;
  meta: ItemMeta;
}

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
  /** Storage download URL. Absent on seeded fixtures with no bytes behind them. */
  url?: string;
  mime?: string;
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
 *
 * One unified `items` list rather than separate `boards`/`conversations`
 * arrays (the earlier shape) — the sidebar shows every kind of folder
 * content now, not just those two, and a per-kind array for each of
 * conversation/board/document/embed would just be the same list partitioned
 * five ways for no benefit. `file` is deliberately excluded: uploaded files
 * don't get their own row in the tree, the same way they don't in Trello's
 * or Notion's sidebars — they're reachable from the folder page and Library.
 */
export interface NavFolder {
  id: string;
  name: string;
  /** One of `SWATCH_COLORS`. Absent on folders created before this existed. */
  color?: string;
  items: Array<{
    id: string;
    name: string;
    kind: Exclude<ItemKind, "file">;
    meta: ItemMeta;
    /** Only set for `kind: "board"` — the board's own colour, not the item's. */
    color?: string;
  }>;
  /**
   * Clients linked to this folder via `Person.folderId`. A separate array
   * rather than folded into `items`: a client is a `people` document, not a
   * `FolderItem` — it has no `kind`/`meta` shape and isn't part of the
   * folder's own `itemIds` ordering, so it doesn't fit the invariant `items`
   * otherwise holds (every entry mirrors a real FolderItem doc).
   */
  clients: Array<{ id: string; name: string; initials: string; color: string }>;
}
