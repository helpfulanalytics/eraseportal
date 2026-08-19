/**
 * Firestore reads for the workspace. **Server-only.**
 *
 * Importing this from a client component throws — see the guard in
 * `firebase/admin.ts`. Client components take their data as props from a
 * server component, or from `WorkspaceProvider` for the few values (people
 * directory, current user) that are needed too deep to thread by hand.
 *
 * Every accessor is `async` now. That's the one unavoidable break from the
 * mock version: call sites need `await`, though almost all of them were
 * already in `async` server components for `params`.
 *
 * Document shape is the domain type minus `id`, which lives in the document
 * key. `one()` and `many()` put it back.
 */
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminBucket, adminDb } from "./firebase/admin";
import { getSessionUser } from "./firebase/session";
import { docBlocksOf, docPreview, documentKind, newBlockId } from "./doc-blocks";
import { blockPreview, SWATCH_COLORS } from "./kitchen-format";
import type {
  Attachment,
  Block,
  Board,
  BoardCard,
  BoardCardComment,
  BoardColumn,
  CanvasNode,
  Conversation,
  ConversationFile,
  DocBlock,
  DocumentKind,
  Embed,
  Folder,
  FolderAccess,
  FolderItem,
  InboxActivity,
  Inline,
  InboxEntry,
  InboxMessage,
  Invite,
  ItemKind,
  ItemMeta,
  KDocument,
  MemberRole,
  LibraryFile,
  Message,
  NavFolder,
  Organization,
  Person,
  Reaction,
  Task,
  Template,
  Workspace,
} from "./kitchen-types";

const COLLECTIONS = {
  workspaces: "workspaces",
  people: "people",
  folders: "folders",
  items: "items",
  conversations: "conversations",
  messages: "messages",
  boards: "boards",
  documents: "documents",
  embeds: "embeds",
  organizations: "organizations",
  templates: "templates",
  tasks: "tasks",
  inbox: "inbox",
  invites: "invites",
} as const;

/** The single workspace this deployment serves. Matches WORKSPACE in the seed. */
export const WORKSPACE_ID = "ws_kea";

/* ---- snapshot mapping ------------------------------------------------ */

type Doc = FirebaseFirestore.DocumentSnapshot;
type Query = FirebaseFirestore.Query;

function hydrate<T>(doc: Doc): T {
  return { id: doc.id, ...doc.data() } as T;
}

/** Inverse of `hydrate`: the id lives in the document key, not the body. */
function withoutId<T extends { id: string }>(doc: T): Omit<T, "id"> {
  const rest = { ...doc } as Partial<T>;
  delete rest.id;
  return rest as Omit<T, "id">;
}

async function one<T>(collection: string, id: string): Promise<T | undefined> {
  const doc = await adminDb().collection(collection).doc(id).get();
  return doc.exists ? hydrate<T>(doc) : undefined;
}

async function many<T>(query: Query): Promise<T[]> {
  const snap = await query.get();
  return snap.docs.map((d) => hydrate<T>(d));
}

function collection(name: string): Query {
  return adminDb().collection(name);
}

/**
 * Catches the exact failure mode that hid every folder's count on the
 * dashboard: an `orderBy` (or any other clause) on a field some documents
 * don't have silently excludes them from the results, with no error. A
 * `.count()` aggregate runs the same base query without applying result
 * transforms like `orderBy`, so a mismatch here means the *fetch* clause —
 * not the underlying data — is dropping documents.
 *
 * Logs and moves on rather than throwing: this is a smoke detector, not a
 * gate, and a false positive shouldn't take the page down.
 */
async function warnIfCountMismatch(
  label: string,
  countQuery: Query,
  fetchedCount: number,
): Promise<void> {
  try {
    const snap = await countQuery.count().get();
    const actual = snap.data().count;
    if (actual !== fetchedCount) {
      console.error(
        `[data integrity] ${label}: fetched ${fetchedCount} but ${actual} exist — a query clause is silently dropping documents.`,
      );
    }
  } catch (cause) {
    // Aggregate queries need no new index, but don't let a transient
    // failure here mask the real result.
    console.error(`[data integrity] ${label}: count check failed`, cause);
  }
}

/* ---- singles --------------------------------------------------------- */

export async function getWorkspace(): Promise<Workspace> {
  const ws = await one<Workspace>(COLLECTIONS.workspaces, WORKSPACE_ID);
  // The shell renders the workspace name on every route, so a missing doc
  // would white-screen the whole app rather than one page. Degrade instead.
  return ws ?? { id: WORKSPACE_ID, name: "Workspace" };
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return one<Folder>(COLLECTIONS.folders, id);
}

export async function getConversation(
  id: string,
): Promise<Conversation | undefined> {
  return one<Conversation>(COLLECTIONS.conversations, id);
}

export async function getPerson(id: string): Promise<Person | undefined> {
  return one<Person>(COLLECTIONS.people, id);
}

export async function getBoard(id: string): Promise<Board | undefined> {
  return one<Board>(COLLECTIONS.boards, id);
}

export async function getDocument(id: string): Promise<KDocument | undefined> {
  return one<KDocument>(COLLECTIONS.documents, id);
}

export async function getEmbed(id: string): Promise<Embed | undefined> {
  return one<Embed>(COLLECTIONS.embeds, id);
}

/**
 * One message by id. Reactions act on a message directly, so the action has
 * nothing but the id to check access with — it reads this, then the
 * conversation, then the folder.
 */
export async function getMessage(id: string): Promise<Message | undefined> {
  return one<Message>(COLLECTIONS.messages, id);
}

export async function getOrganization(id: string): Promise<Organization | undefined> {
  return one<Organization>(COLLECTIONS.organizations, id);
}

/** The org's workspace portal is reached by slug, not id — `/w/{slug}`. */
export async function getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
  const matches = await many<Organization>(
    collection(COLLECTIONS.organizations).where("slug", "==", slug).limit(1),
  );
  return matches[0];
}

/* ---- collections ----------------------------------------------------- */

function filterByFolderAccess(folders: Folder[], me: Person | null): Folder[] {
  if (!me) return [];
  if (me.kind === "member") return folders;
  return folders.filter((folder) => folder.authorId === me.id || folder.roles?.[me.id]);
}

/* ---- collections ----------------------------------------------------- */

/**
 * Unfiltered when called with no `opts` (members see every organization's
 * folders). Pass `opts` — even `{ organizationId: undefined }`, e.g. a
 * client somehow missing one — to scope to one tenant; a client with no
 * `organizationId` correctly gets back nothing rather than every folder in
 * the workspace.
 *
 * The scoped query sorts in memory rather than via `.orderBy("name")`:
 * an equality filter plus an order-by on a *different* field needs a
 * composite index (see the `messages` index in firestore.indexes.json for
 * the same situation), and this avoids requiring a new one just for
 * organization-scoped folder lists.
 *
 * `parentFolderId` filters after the fetch rather than as a second `.where`,
 * for the same reason — one more equality filter would still dodge the
 * composite-index requirement (it only kicks in with an `.orderBy`), but the
 * in-memory pass here is simpler than threading a second, conditionally-
 * present `.where` through the two query branches above. Pass `null` for
 * top-level folders only (e.g. the sidebar), a string for one folder's
 * children, or omit it for every folder regardless of nesting.
 */
export async function getFolders(opts?: {
  organizationId?: string;
  parentFolderId?: string | null;
}): Promise<Folder[]> {
  const me = await getCurrentUser();
  let folders: Folder[];
  if (opts === undefined) {
    const base = collection(COLLECTIONS.folders);
    folders = await many<Folder>(base);
    void warnIfCountMismatch("getFolders(unfiltered)", base, folders.length);
  } else if (!opts.organizationId) {
    return [];
  } else {
    folders = await many<Folder>(
      collection(COLLECTIONS.folders).where("organizationId", "==", opts.organizationId),
    );
  }
  if (opts?.parentFolderId !== undefined) {
    folders = folders.filter((f) => (f.parentFolderId ?? null) === opts.parentFolderId);
  }
  folders.sort((a, b) => {
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    if (posA !== posB) return posA - posB;
    return a.name.localeCompare(b.name);
  });
  return filterByFolderAccess(folders, me);
}

/**
 * Keyed by id, matching the shape the mock exported — components look people
 * up by id far more often than they iterate. Small enough (a workspace's
 * members plus its clients) to fetch whole.
 */
export async function getPeople(): Promise<Record<string, Person>> {
  const list = await many<Person>(collection(COLLECTIONS.people));
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

export async function getClients(): Promise<Person[]> {
  return many<Person>(
    collection(COLLECTIONS.people).where("kind", "==", "client"),
  );
}

/**
 * The agency roster — everyone the Team page lists, deactivated people
 * included, since removal is reversible and a removed member still needs a
 * row to be restored from. Callers that want only working members filter on
 * `isActive` from `permissions.ts`.
 */
export async function getMembers(): Promise<Person[]> {
  const members = await many<Person>(
    collection(COLLECTIONS.people).where("kind", "==", "member"),
  );
  return members.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Used to reject an invite to an address that already has a Person — without
 * it, a second invite would create a duplicate directory entry, and the
 * email-adoption branch in `getCurrentUser` would then resolve whichever one
 * the query happened to return first.
 */
export async function getPersonByEmail(
  email: string,
): Promise<Person | undefined> {
  const matches = await many<Person>(
    collection(COLLECTIONS.people).where("email", "==", email).limit(1),
  );
  return matches[0];
}

export async function getOrganizations(): Promise<Organization[]> {
  return many<Organization>(collection(COLLECTIONS.organizations).orderBy("name"));
}

export async function getTemplates(): Promise<Template[]> {
  return many<Template>(collection(COLLECTIONS.templates).orderBy("name"));
}

export async function getTasks(): Promise<Task[]> {
  return many<Task>(collection(COLLECTIONS.tasks));
}

export async function getInbox(): Promise<InboxEntry[]> {
  return many<InboxEntry>(
    collection(COLLECTIONS.inbox).orderBy("createdAt", "desc"),
  );
}

/* ---- inbox views ------------------------------------------------------ */

/**
 * The newest messages across every conversation in one organization —
 * what the Inbox's Chats tab lists.
 *
 * Scoping happens in memory rather than in the query. A message carries only
 * `conversationId`; the organization boundary lives two joins away, on the
 * conversation's folder, and Firestore can't express that. So this reads a
 * window of recent messages globally, then keeps the ones whose conversation
 * belongs to a folder in scope. The window is deliberately several times the
 * requested count: if another organization is noisy, its messages eat into
 * the window, and over-fetching is what stops the tab looking empty. It is
 * the same trade `getLibraryFiles` makes, and the first thing to fix by
 * denormalising `organizationId` onto `messages` if the workspace grows.
 *
 * `.limit()` keeps that window bounded, and `orderBy("createdAt")` on its own
 * needs no composite index — single-field indexes are automatic.
 */
export async function getRecentMessages(opts: {
  organizationId?: string;
  limit?: number;
  excludeAuthorId?: string;
}): Promise<InboxMessage[]> {
  const limit = opts.limit ?? 40;

  const [messages, conversations, folders, people] = await Promise.all([
    many<Message>(
      collection(COLLECTIONS.messages)
        .orderBy("createdAt", "desc")
        .limit(limit * 5),
    ),
    many<Conversation>(collection(COLLECTIONS.conversations)),
    getFolders(opts.organizationId ? { organizationId: opts.organizationId } : undefined),
    getPeople(),
  ]);

  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  const inScope = new Map(
    conversations
      .filter((c) => folderName.has(c.folderId))
      .map((c) => [c.id, c]),
  );

  // Resolved here rather than at render: `blockPreview` needs the handle for
  // every @mention, and the row is a plain string by the time it crosses to
  // the client.
  const handles = Object.fromEntries(
    Object.values(people).map((person) => [person.id, person.handle]),
  );

  const rows: InboxMessage[] = [];
  for (const message of messages) {
    if (opts.excludeAuthorId && message.authorId === opts.excludeAuthorId) {
      continue;
    }

    const conversation = inScope.get(message.conversationId);
    if (!conversation) continue;

    rows.push({
      id: message.id,
      conversationId: conversation.id,
      conversationName: conversation.name,
      folderId: conversation.folderId,
      folderName: folderName.get(conversation.folderId) ?? "",
      authorId: message.authorId,
      createdAt: message.createdAt,
      preview: blockPreview(message.body, handles),
      attachmentCount: message.attachments?.length ?? 0,
      ...(message.isNote ? { isNote: true } : {}),
    });

    if (rows.length >= limit) break;
  }

  return rows;
}

/**
 * Recently created folder items — the Updates tab.
 *
 * Same in-memory org scoping as `getRecentMessages`, for the same reason:
 * an `items` row has a `folderId`, not an `organizationId`.
 */
export async function getRecentActivity(opts: {
  organizationId?: string;
  limit?: number;
  excludeAuthorId?: string;
}): Promise<InboxActivity[]> {
  const limit = opts.limit ?? 40;

  const [items, folders] = await Promise.all([
    many<FolderItem>(
      collection(COLLECTIONS.items).orderBy("createdAt", "desc").limit(limit * 5),
    ),
    getFolders(opts.organizationId ? { organizationId: opts.organizationId } : undefined),
  ]);

  const folderName = new Map(folders.map((f) => [f.id, f.name]));

  return items
    .filter((item) => folderName.has(item.folderId))
    .filter((item) => !opts.excludeAuthorId || item.authorId !== opts.excludeAuthorId)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      folderId: item.folderId,
      folderName: folderName.get(item.folderId) ?? "",
      authorId: item.authorId,
      createdAt: item.createdAt,
      meta: item.meta,
    }));
}

/* ---- relations ------------------------------------------------------- */

/**
 * Ordered by the folder's own `itemIds` rather than by any field on the items:
 * folder contents are hand-arranged, and that order is the folder's data, not
 * the item's.
 */
export async function getFolderItems(folderId: string): Promise<FolderItem[]> {
  const folder = await getFolder(folderId);
  if (!folder) return [];

  const items = await many<FolderItem & { downloadUrl?: string }>(
    collection(COLLECTIONS.items).where("folderId", "==", folderId),
  );
  
  const byId = new Map(items.map((i) => [i.id, withFileUrl(i)]));

  return folder.itemIds
    .map((id) => byId.get(id))
    .filter((i): i is FolderItem => i !== undefined);
}

/**
 * Lifts an upload's Storage URL from where `createFolderFile` has always
 * written it — a top-level `downloadUrl` on the item document, outside the
 * `FolderItem` type — into `meta.url`, where the listing reads it.
 *
 * Doing it on read rather than migrating the documents means files uploaded
 * before anything rendered them are openable now, with no backfill script.
 */
function withFileUrl(item: FolderItem & { downloadUrl?: string }): FolderItem {
  const { downloadUrl, ...rest } = item;
  if (rest.meta?.type !== "file" || rest.meta.url || !downloadUrl) return rest;
  return { ...rest, meta: { ...rest.meta, url: downloadUrl } };
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return many<Message>(
    collection(COLLECTIONS.messages)
      .where("conversationId", "==", conversationId)
      .orderBy("createdAt"),
  );
}

export async function getConversationsInFolder(
  folderId: string,
): Promise<Conversation[]> {
  return many<Conversation>(
    collection(COLLECTIONS.conversations).where("folderId", "==", folderId),
  );
}

/** Files attached to any message in a conversation — powers the Files tab. */
export async function getConversationFiles(
  conversationId: string,
): Promise<ConversationFile[]> {
  const messages = await getMessages(conversationId);
  return messages.flatMap((m) =>
    (m.attachments ?? []).map((a) => ({
      ...a,
      messageId: m.id,
      createdAt: m.createdAt,
      authorId: m.authorId,
    })),
  );
}

/**
 * Every file in the workspace — message attachments plus uploaded items.
 *
 * Attachments are embedded in message documents rather than stored as their
 * own collection, which means there's no query that returns them directly:
 * this reads every conversation's messages. Fine at one workspace's scale,
 * but it's the first thing to denormalise into a `files` collection if the
 * Library page ever gets slow.
 */
export async function getLibraryFiles(): Promise<LibraryFile[]> {
  const [rawItems, folders, conversations] = await Promise.all([
    many<FolderItem & { downloadUrl?: string }>(
      collection(COLLECTIONS.items).where("kind", "==", "file"),
    ),
    getFolders(),
    many<Conversation>(collection(COLLECTIONS.conversations)),
  ]);

  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  // Same lift as `getFolderItems` — the URL has always been written outside
  // the typed shape.
  const fileItems = rawItems.map(withFileUrl);

  const uploaded = fileItems
    .filter((i) => i.meta.type === "file")
    .map((i) => {
      const meta = i.meta as Extract<ItemMeta, { type: "file" }>;
      return {
        id: i.id,
        name: i.name,
        label: meta.label,
        bytes: meta.bytes,
        createdAt: i.createdAt,
        authorId: i.authorId,
        folderId: i.folderId,
        source: folderName.get(i.folderId) ?? "—",
        ...(meta.url ? { url: meta.url } : {}),
        ...(meta.mime ? { mime: meta.mime } : {}),
      };
    });

  const attached = (
    await Promise.all(
      conversations.map(async (conv) =>
        (await getConversationFiles(conv.id)).map((f) => ({
          id: f.id,
          name: f.name,
          label: f.label,
          bytes: f.bytes,
          createdAt: f.createdAt,
          authorId: f.authorId,
          folderId: conv.folderId,
          source: conv.name,
          ...(f.url ? { url: f.url } : {}),
          ...(f.mime ? { mime: f.mime } : {}),
        })),
      ),
    )
  ).flat();

  return [...uploaded, ...attached].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * The sidebar's folder tree, fetched once in the workspace layout and passed
 * down. One query per folder for its conversations — acceptable because the
 * layout result is shared across every route beneath it.
 *
 * Pass `organizationId` for a client's session so folders outside their
 * organization never reach the sidebar at all.
 *
 * Only top-level folders — nested ones are reached by drilling in from
 * their parent's page, not from the flat sidebar tree.
 */
export async function getNavTree(opts?: { organizationId?: string }): Promise<NavFolder[]> {
  const folders = opts === undefined
    ? (await getFolders()).filter((f) => !f.parentFolderId)
    : await getFolders({ organizationId: opts.organizationId, parentFolderId: null });
  return Promise.all(
    folders.map(async (folder) => {
      // getFolderItems already carries kind + meta for everything (in the
      // folder's hand-arranged order), which is enough to pick an icon and
      // build an href — except a board's colour, which lives only on the
      // board document. That's the one thing worth a follow-up read.
      // Clients aren't FolderItem docs at all — a separate query.
      const [items, boards, clients] = await Promise.all([
        getFolderItems(folder.id),
        getBoardsInFolder(folder.id),
        getClientsInFolder(folder.id),
      ]);
      const boardColor = new Map(boards.map((b) => [b.id, b.color]));

      return {
        id: folder.id,
        name: folder.name,
        color: folder.color,
        items: items
          .filter((i) => i.kind !== "file")
          .map((i) => ({
            id: i.id,
            name: i.name,
            kind: i.kind as Exclude<ItemKind, "file">,
            meta: i.meta,
            color: i.kind === "board" ? boardColor.get(i.id) : undefined,
          })),
        clients: clients.map((c) => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          color: c.color,
        })),
      };
    }),
  );
}

export async function getBoardsInFolder(folderId: string): Promise<Board[]> {
  return many<Board>(
    collection(COLLECTIONS.boards).where("folderId", "==", folderId),
  );
}

/* ---- session --------------------------------------------------------- */

/**
 * The signed-in user as a domain Person, or null when nobody is signed in.
 *
 * Auth identity and workspace identity are separate: Firebase knows a uid,
 * the workspace knows a Person. They're joined by the `uid` field written to
 * the person document on first sign-in.
 *
 * **The workspace is invite-only.** Authenticating proves who you are, not
 * that you belong here — an account with no corresponding Person resolves to
 * `null`, exactly like being signed out. This used to auto-provision such an
 * account as `kind: "member"`, which meant anyone who completed the public
 * sign-up form became an admin over every organization. A Person now comes
 * into existence only through an invite (`createClient` / `createMember`) or
 * the seed script. `(workspace)/layout.tsx` distinguishes the two `null`
 * cases and routes an authenticated stranger to `/no-access`, so the dead end
 * is explained rather than silently looping back to sign-in.
 */
export async function getCurrentUser(): Promise<Person | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const byUid = await many<Person>(
    collection(COLLECTIONS.people).where("uid", "==", session.uid).limit(1),
  );
  // Checked on both branches: removal sets `deactivatedAt` rather than
  // deleting the document (see `Person.deactivatedAt`), so this is the read
  // that has to enforce it. Their existing session cookie is revoked at
  // removal time too — this covers the gap either way round.
  if (byUid.length > 0) {
    return byUid[0].deactivatedAt ? null : byUid[0];
  }

  // First sign-in for someone seeded by email but never linked: adopt them.
  if (session.email) {
    const byEmail = await many<Person>(
      collection(COLLECTIONS.people)
        .where("email", "==", session.email)
        .limit(1),
    );
    if (byEmail.length > 0) {
      if (byEmail[0].deactivatedAt) return null;
      await adminDb()
        .collection(COLLECTIONS.people)
        .doc(byEmail[0].id)
        .set({ uid: session.uid }, { merge: true });
      return { ...byEmail[0], uid: session.uid };
    }
  }

  return null;
}

/** Avatar tints, matching the palette the seeded people use. */
const PERSON_COLORS = [
  "var(--k-purple)",
  "var(--k-blue)",
  "var(--k-green-0e)",
  "var(--k-yellow)",
  "var(--k-red)",
];

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic tint, so a person's avatar colour never moves. */
function tintFor(id: string): string {
  return PERSON_COLORS[
    Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) %
      PERSON_COLORS.length
  ];
}

/* ---- writes ---------------------------------------------------------- */

/**
 * Records a file that has already been uploaded to Storage.
 *
 * Two writes, batched: the item document itself, and the id appended to the
 * folder's `itemIds`. Both are required — `getFolderItems` orders by
 * `itemIds`, so an item missing from that array exists in the collection but
 * never renders.
 */
export async function createFolderFile(input: {
  folderId: string;
  authorId: string;
  name: string;
  bytes: number;
  mime: string;
  label: string;
  storagePath: string;
  downloadUrl: string;
}): Promise<FolderItem> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.items).doc();

  const item: FolderItem = {
    id: doc.id,
    kind: "file",
    name: input.name,
    folderId: input.folderId,
    createdAt: new Date().toISOString(),
    authorId: input.authorId,
    meta: {
      type: "file",
      mime: input.mime,
      label: input.label,
      bytes: input.bytes,
    },
  };

  const batch = db.batch();
  const { id, ...rest } = item;
  batch.set(doc, {
    ...rest,
    // Not on FolderItem: the domain type predates Storage, and nothing renders
    // these yet. Persisted so the bytes stay reachable once something does.
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
  });
  batch.update(db.collection(COLLECTIONS.folders).doc(input.folderId), {
    itemIds: FieldValue.arrayUnion(id),
    updatedAt: new Date().toISOString(),
  });
  await batch.commit();

  return item;
}

/**
 * Bootstrap the workspace document if it doesn't exist yet.
 *
 * `getWorkspace` degrades to a placeholder name rather than failing, which
 * keeps an empty database renderable — but the first real write should put a
 * document behind it so the name is editable in Settings.
 */
export async function ensureWorkspace(): Promise<void> {
  const ref = adminDb().collection(COLLECTIONS.workspaces).doc(WORKSPACE_ID);
  const doc = await ref.get();
  if (!doc.exists) await ref.set({ name: "Workspace" });
}

export async function setWorkspaceName(name: string): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.workspaces)
    .doc(WORKSPACE_ID)
    .set({ name }, { merge: true });
}

export async function createFolder(input: {
  name: string;
  description?: string;
  access?: FolderAccess;
  internalRole?: "viewer" | "editor";
  /** Absent = agency-internal, no client can ever see it. */
  organizationId?: string;
  /**
   * The folder this one nests inside, if any. Its `organizationId` wins over
   * `input.organizationId` — a nested folder always shares its parent's org,
   * so the parent picker a nested-create flow skips can't disagree with it.
   */
  parentFolderId?: string;
}): Promise<Folder> {
  await ensureWorkspace();

  const organizationId = input.parentFolderId
    ? (await getFolder(input.parentFolderId))?.organizationId ?? input.organizationId
    : input.organizationId;

  const doc = adminDb().collection(COLLECTIONS.folders).doc();
  const folder: Folder = {
    id: doc.id,
    name: input.name,
    starred: false,
    itemIds: [],
    access: input.access ?? "private",
    // Firestore rejects `undefined`, so optional fields are spread in only
    // when they have a value rather than written as undefined.
    ...(input.description ? { description: input.description } : {}),
    ...(input.access === "internal" && input.internalRole
      ? { internalRole: input.internalRole }
      : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(input.parentFolderId ? { parentFolderId: input.parentFolderId } : {}),
  };

  await doc.set(withoutId(folder));
  return folder;
}

/**
 * `acme-inc` from "Acme Inc.", plus a short random suffix so two orgs with
 * similar names (or a re-created one) don't collide on the same portal path.
 */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = randomUUID().slice(0, 5);
  return `${base || "org"}-${suffix}`;
}

export async function createOrganization(input: {
  name: string;
  domain: string;
}): Promise<Organization> {
  const doc = adminDb().collection(COLLECTIONS.organizations).doc();
  const organization: Organization = {
    id: doc.id,
    name: input.name,
    domain: input.domain,
    createdAt: new Date().toISOString(),
    slug: slugify(input.name),
  };

  await doc.set(withoutId(organization));
  return organization;
}

/**
 * A folder's name has one copy, unlike a board's or a conversation's — the
 * sidebar and the folder listing both read `folders/{id}.name` directly,
 * nothing duplicates it onto an `items` row (a folder isn't itself an item
 * of another folder).
 */
export async function renameFolder(folderId: string, name: string): Promise<void> {
  await adminDb().collection(COLLECTIONS.folders).doc(folderId).update({ name });
}

export async function renameOrganization(
  organizationId: string,
  name: string,
): Promise<void> {
  await adminDb().collection(COLLECTIONS.organizations).doc(organizationId).update({ name });
}

/**
 * Deletes a folder only if it's empty. A folder's contents span five
 * collections (conversations, boards, documents, embeds, files) each with
 * their own nested state — messages under a conversation, cards under a
 * board — and cascading all of that safely in one operation is a
 * meaningfully bigger, riskier piece of work than anything else in this
 * file. Requiring "empty it first" keeps deletion honest about what it
 * actually does, rather than silently destroying everything beneath it.
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await getFolder(folderId);
  if (!folder) return;
  if (folder.itemIds.length > 0) {
    throw new Error(
      `This folder still has ${folder.itemIds.length} item(s) in it. Move or delete them first.`,
    );
  }

  // Subfolders live as their own docs (`parentFolderId`, not `itemIds`), so
  // the check above misses them — without this, deleting a parent would
  // leave children pointing at a `parentFolderId` that no longer exists.
  const children = folder.organizationId
    ? await getFolders({ organizationId: folder.organizationId, parentFolderId: folderId })
    : (await getFolders()).filter((f) => f.parentFolderId === folderId);
  if (children.length > 0) {
    throw new Error(
      `This folder still has ${children.length} subfolder(s) in it. Delete them first.`,
    );
  }

  await adminDb().collection(COLLECTIONS.folders).doc(folderId).delete();
}

/**
 * The folder's own description. Written by the Create Folder dialog since the
 * beginning and rendered by nothing until the header's description toggle
 * started showing it.
 */
export async function setFolderDescription(
  folderId: string,
  description: string,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.folders)
    .doc(folderId)
    // Stored as an empty string rather than deleted when cleared: Firestore
    // rejects `undefined`, and a missing field and an empty one already mean
    // the same thing to every reader.
    .update({ description });
}

/** Like a board's colour, this has one source of truth — no `items` copy to keep in sync. */
export async function setFolderColor(folderId: string, color: string): Promise<void> {
  await adminDb().collection(COLLECTIONS.folders).doc(folderId).update({ color });
}

/**
 * The bytes are already in Storage by the time this runs — the browser
 * uploads directly (see `uploadFile` in `firebase/storage.ts`) and this just
 * records where. Reuses the same `folders/{folderId}` Storage prefix as a
 * regular file upload rather than a `folders/{folderId}/cover` subpath,
 * because storage.rules only has a match block for that exact shape; a cover
 * subfolder would need a rules change this doesn't need.
 */
export async function setFolderCoverUrl(folderId: string, url: string): Promise<void> {
  await adminDb().collection(COLLECTIONS.folders).doc(folderId).update({ coverUrl: url });
}

/** Client onboarding's name-confirmation + avatar step. */
export async function setPersonProfile(
  personId: string,
  input: { name?: string; avatarUrl?: string },
): Promise<void> {
  const updates: Record<string, string> = {};
  if (input.name) {
    updates.name = input.name;
    updates.initials = initialsFrom(input.name);
  }
  if (input.avatarUrl) updates.avatarUrl = input.avatarUrl;
  if (Object.keys(updates).length === 0) return;

  await adminDb().collection(COLLECTIONS.people).doc(personId).set(updates, { merge: true });
}

export async function addDeviceToken(personId: string, token: string): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.people)
    .doc(personId)
    .update({
      fcmTokens: FieldValue.arrayUnion(token),
    });
}

export async function removeDeviceToken(personId: string, token: string): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.people)
    .doc(personId)
    .update({
      fcmTokens: FieldValue.arrayRemove(token),
    });
}

/**
 * A conversation is three writes, not one: the conversation itself, the
 * `items` row that makes it show up in the folder listing, and the id appended
 * to the folder's `itemIds` (which is what `getFolderItems` orders by). Miss
 * any of them and it exists but never renders.
 *
 * The item and the conversation deliberately share an id — that's the
 * convention the seeded data uses, and `itemHref` relies on it to build the
 * link straight from a folder row.
 */
export async function createConversation(input: {
  folderId: string;
  name: string;
  authorId: string;
  participantIds: string[];
}): Promise<Conversation> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.conversations).doc();

  const conversation: Conversation = {
    id: doc.id,
    name: input.name,
    folderId: input.folderId,
    participantIds: input.participantIds,
    starred: false,
  };

  const batch = db.batch();
  batch.set(doc, withoutId(conversation));
  linkItemIntoFolder(batch, {
    id: doc.id,
    kind: "conversation",
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    meta: { type: "conversation", messageCount: 0 },
  });
  await batch.commit();

  return conversation;
}

/**
 * Same dual-write as `renameBoard`: a conversation's name lives on the
 * conversation document and again on its `items` row, and both have to
 * agree or the sidebar and the folder listing show a different name than
 * the conversation page itself.
 */
export async function renameConversation(
  conversationId: string,
  name: string,
): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  batch.update(db.collection(COLLECTIONS.conversations).doc(conversationId), { name });
  batch.update(db.collection(COLLECTIONS.items).doc(conversationId), { name });
  await batch.commit();
}

/**
 * Deletes a conversation, every message in it, and its folder reference.
 * Messages aren't paginated here — batched deletes in groups of 500, which
 * is Firestore's own cap per batch — because this app has no conversation
 * anywhere close to that size; the moment one does, this is the function to
 * revisit.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return;

  const db = adminDb();
  const messages = await db
    .collection(COLLECTIONS.messages)
    .where("conversationId", "==", conversationId)
    .get();

  for (let i = 0; i < messages.docs.length; i += 500) {
    const batch = db.batch();
    for (const doc of messages.docs.slice(i, i + 500)) batch.delete(doc.ref);
    await batch.commit();
  }

  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.conversations).doc(conversationId));
  unlinkItemFromFolder(batch, {
    id: conversationId,
    folderId: conversation.folderId,
  });
  await batch.commit();
}

/**
 * Post a message. Plain text in, structured blocks out — one paragraph per
 * blank-line-separated chunk, matching the shape the renderer expects and the
 * seeded data uses.
 *
 * Also bumps the folder item's `messageCount`, since that's denormalised onto
 * the item for the folder listing and would otherwise drift immediately.
 */
/**
 * Splits a plain-text paragraph into text and link runs.
 *
 * `RichText` has rendered `{ t: "link" }` since the first mock and nothing
 * ever produced one — a URL someone typed arrived as inert text. The pattern
 * stops before trailing punctuation so "see https://example.com." doesn't
 * swallow the full stop into the href.
 */
function autolink(text: string): Inline[] {
  const pattern = /https?:\/\/[^\s<]+[^\s<.,:;"')\]}]/g;
  const runs: Inline[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) runs.push({ t: "text", v: text.slice(cursor, start) });
    runs.push({ t: "link", href: match[0] });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) runs.push({ t: "text", v: text.slice(cursor) });
  return runs.length ? runs : [{ t: "text", v: text }];
}

export async function sendMessage(input: {
  conversationId: string;
  /** Bumps the parent folder's `updatedAt` in the same batch when passed. */
  folderId?: string;
  authorId: string;
  text: string;
  isNote?: boolean;
  attachments?: Attachment[];
}): Promise<Message> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.messages).doc();

  const body: Block[] = input.text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({ b: "p", children: autolink(chunk) }));

  const message: Message = {
    id: doc.id,
    conversationId: input.conversationId,
    authorId: input.authorId,
    createdAt: new Date().toISOString(),
    body,
    ...(input.isNote ? { isNote: true } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  };

  const batch = db.batch();
  batch.set(doc, withoutId(message));
  // The conversation's folder item carries a messageCount for the folder list.
  batch.set(
    db.collection(COLLECTIONS.items).doc(input.conversationId),
    { meta: { type: "conversation", messageCount: FieldValue.increment(1) } },
    { merge: true },
  );
  if (input.folderId) {
    batch.set(
      db.collection(COLLECTIONS.folders).doc(input.folderId),
      { updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  await batch.commit();

  return message;
}

/**
 * Adds or removes one person's reaction to a message, and returns the
 * message's reactions afterwards.
 *
 * Read-modify-write, like the board's card helpers, and for the same reason:
 * `reactions` is an array of maps, so there's no field path that can add a
 * person to the right emoji's `personIds`. `arrayUnion` can't help either —
 * it matches whole elements, and the element here changes shape as people
 * join it.
 *
 * The whole array is rewritten rather than patched (handoff-2, trap 8), and
 * an emoji nobody is left reacting with is dropped instead of being left as
 * an empty pill.
 */
export async function toggleReaction(input: {
  messageId: string;
  emoji: string;
  personId: string;
}): Promise<Reaction[]> {
  const ref = adminDb().collection(COLLECTIONS.messages).doc(input.messageId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("That message no longer exists.");

  const current = (snapshot.data()?.reactions ?? []) as Reaction[];
  const existing = current.find((r) => r.emoji === input.emoji);

  let next: Reaction[];
  if (!existing) {
    next = [...current, { emoji: input.emoji, personIds: [input.personId] }];
  } else if (existing.personIds.includes(input.personId)) {
    const personIds = existing.personIds.filter((id) => id !== input.personId);
    next = personIds.length
      ? current.map((r) => (r.emoji === input.emoji ? { ...r, personIds } : r))
      : current.filter((r) => r.emoji !== input.emoji);
  } else {
    next = current.map((r) =>
      r.emoji === input.emoji
        ? { ...r, personIds: [...r.personIds, input.personId] }
        : r,
    );
  }

  await ref.update({ reactions: next });
  return next;
}

/**
 * Everything that can be favourited. `starred` lives on the entity's own
 * document rather than on its `items` row: a folder has no `items` row at
 * all, so the item table can't be the one place it's kept.
 */
export const STARRABLE = {
  folder: COLLECTIONS.folders,
  conversation: COLLECTIONS.conversations,
  board: COLLECTIONS.boards,
  document: COLLECTIONS.documents,
  embed: COLLECTIONS.embeds,
} as const;

export type StarrableKind = keyof typeof STARRABLE;

/**
 * Stars or unstars anything with a star on its header.
 *
 * `Folder.starred` and `Conversation.starred` have been in the model since
 * the original scan and nothing ever wrote either; board, document and embed
 * gained the field when the star behind them was wired up.
 */
export async function setStarred(
  kind: StarrableKind,
  id: string,
  starred: boolean,
): Promise<void> {
  await adminDb().collection(STARRABLE[kind]).doc(id).update({ starred });
}

/** Clients use this to raise tasks/complaints in their own org's folders. */
export async function createTask(input: {
  title: string;
  folderId?: string;
  dueDate?: string;
  assigneeId?: string;
  authorId: string;
}): Promise<Task> {
  const doc = adminDb().collection(COLLECTIONS.tasks).doc();
  const task: Task = {
    id: doc.id,
    title: input.title,
    status: "todo",
    completed: false,
    authorId: input.authorId,
    ...(input.folderId ? { folderId: input.folderId } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
  };

  await doc.set(withoutId(task));
  return task;
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.tasks)
    .doc(taskId)
    .set(
      { completed, status: completed ? "done" : "todo" },
      { merge: true },
    );
}

/* ---- creating folder contents ---------------------------------------- */

/**
 * Everything that lives inside a folder needs three writes, not one: its own
 * document, the `items` row the folder listing renders, and the id appended to
 * the folder's `itemIds` — which is what `getFolderItems` orders by. An item
 * missing from that array exists in its collection and never appears anywhere.
 *
 * This stages the second and third onto a caller-supplied batch so the whole
 * creation commits atomically. The item deliberately shares the subject's id,
 * which is the convention the seeded data uses and what lets `itemHref` build
 * a link straight from a folder row.
 */
function linkItemIntoFolder(
  batch: FirebaseFirestore.WriteBatch,
  input: {
    id: string;
    kind: ItemKind;
    name: string;
    folderId: string;
    authorId: string;
    meta: ItemMeta;
  },
): void {
  const db = adminDb();
  batch.set(db.collection(COLLECTIONS.items).doc(input.id), {
    kind: input.kind,
    name: input.name,
    folderId: input.folderId,
    createdAt: new Date().toISOString(),
    authorId: input.authorId,
    meta: input.meta,
  });
  batch.update(db.collection(COLLECTIONS.folders).doc(input.folderId), {
    itemIds: FieldValue.arrayUnion(input.id),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * The inverse of `linkItemIntoFolder`: removes an item's row and its id from
 * the owning folder's `itemIds`, in the same batch as deleting the subject
 * document itself. Same three-write shape as creating one, run backwards.
 */
function unlinkItemFromFolder(
  batch: FirebaseFirestore.WriteBatch,
  input: { id: string; folderId: string },
): void {
  const db = adminDb();
  batch.delete(db.collection(COLLECTIONS.items).doc(input.id));
  batch.update(db.collection(COLLECTIONS.folders).doc(input.folderId), {
    itemIds: FieldValue.arrayRemove(input.id),
  });
}

/** Columns a new board starts with, matching the seeded board's shape. */
const DEFAULT_BOARD_COLUMNS = [
  { id: "col_todo", name: "To Do" },
  { id: "col_progress", name: "In Progress" },
  { id: "col_blocked", name: "Blocked" },
  { id: "col_done", name: "Done" },
];

export async function createBoard(input: {
  folderId: string;
  name: string;
  authorId: string;
  color?: string;
}): Promise<Board> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.boards).doc();

  const board: Board = {
    id: doc.id,
    name: input.name,
    folderId: input.folderId,
    columns: DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c, cards: [] })),
    color: input.color ?? SWATCH_COLORS[0],
  };

  const batch = db.batch();
  batch.set(doc, withoutId(board));
  linkItemIntoFolder(batch, {
    id: doc.id,
    kind: "board",
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    meta: { type: "board", cardCount: 0 },
  });
  await batch.commit();

  return board;
}

/**
 * A board's name is stored twice — on the board document itself, and again
 * on its `items` row, which is what the folder listing and sidebar actually
 * render. Both are written in one batch; updating only one would leave the
 * board page and the folder view disagreeing about its name.
 */
export async function renameBoard(boardId: string, name: string): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  batch.update(db.collection(COLLECTIONS.boards).doc(boardId), { name });
  batch.update(db.collection(COLLECTIONS.items).doc(boardId), { name });
  await batch.commit();
}

/**
 * Colour lives only on the board document — unlike the name, it isn't shown
 * on the folder listing row, so there's no second copy to keep in sync.
 */
export async function setBoardColor(boardId: string, color: string): Promise<void> {
  await adminDb().collection(COLLECTIONS.boards).doc(boardId).update({ color });
}

export async function deleteBoard(boardId: string): Promise<void> {
  const board = await getBoard(boardId);
  if (!board) return;

  const db = adminDb();
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.boards).doc(boardId));
  unlinkItemFromFolder(batch, { id: boardId, folderId: board.folderId });
  await batch.commit();
}

/**
 * Both kinds of document — a page of blocks and a canvas of nodes — are one
 * collection and one route. Only the body field and the editor differ, so
 * splitting them would duplicate creation, rename, delete, the folder-item
 * link and the access check for no gain.
 */
export async function createDocument(input: {
  folderId: string;
  name: string;
  authorId: string;
  kind?: DocumentKind;
}): Promise<KDocument> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.documents).doc();
  const now = new Date().toISOString();
  const docKind: DocumentKind = input.kind === "canvas" ? "canvas" : "page";

  const document: KDocument = {
    id: doc.id,
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    updatedAt: now,
    docKind,
    blocks: [],
    // A page starts with one empty block so the editor has somewhere to put
    // the caret on first open; a canvas starts genuinely empty.
    ...(docKind === "canvas"
      ? { nodes: [] }
      : { content: [{ id: newBlockId(), type: "text" as const, html: "" }] }),
  };

  const batch = db.batch();
  batch.set(doc, withoutId(document));
  linkItemIntoFolder(batch, {
    id: doc.id,
    kind: "document",
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    meta: { type: "document", updatedAt: now, docKind },
  });
  await batch.commit();

  return document;
}

/**
 * Saves a page document's body.
 *
 * `updatedAt` is written twice, like a board's name — once on the document
 * and once on the `items` row the folder listing reads, which shows
 * "Updated <date>" without joining back. See trap 10 in handoff-2.
 *
 * The legacy `blocks` field is deliberately left untouched: `content` wins
 * on read once it exists (`docBlocksOf`), and keeping the original means a
 * seeded document isn't destroyed by the first stray keystroke.
 */
export async function saveDocumentContent(
  documentId: string,
  content: DocBlock[],
): Promise<string> {
  const db = adminDb();
  const now = new Date().toISOString();
  const batch = db.batch();

  batch.update(db.collection(COLLECTIONS.documents).doc(documentId), {
    content,
    updatedAt: now,
  });
  // The folder listing shows the document's first line as its subtitle, and
  // reads it from here rather than opening every document to render one page.
  batch.update(db.collection(COLLECTIONS.items).doc(documentId), {
    "meta.updatedAt": now,
    "meta.preview": docPreview(content).slice(0, 200),
  });
  await batch.commit();

  return now;
}

/** The canvas equivalent of `saveDocumentContent`. */
export async function saveDocumentNodes(
  documentId: string,
  nodes: CanvasNode[],
): Promise<string> {
  const db = adminDb();
  const now = new Date().toISOString();
  const batch = db.batch();

  batch.update(db.collection(COLLECTIONS.documents).doc(documentId), {
    nodes,
    updatedAt: now,
  });
  // A canvas has no first line, so its subtitle counts what's on it.
  batch.update(db.collection(COLLECTIONS.items).doc(documentId), {
    "meta.updatedAt": now,
    "meta.preview": canvasPreview(nodes),
  });
  await batch.commit();

  return now;
}

/** Dual-write name, exactly as `renameBoard` does — see trap 10. */
export async function renameDocument(documentId: string, name: string): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  batch.update(db.collection(COLLECTIONS.documents).doc(documentId), { name });
  batch.update(db.collection(COLLECTIONS.items).doc(documentId), { name });
  await batch.commit();
}

/** "3 notes, 1 shape" — what a canvas can say about itself in one line. */
function canvasPreview(nodes: CanvasNode[]): string {
  if (nodes.length === 0) return "Empty board";

  const notes = nodes.filter((n) => n.kind === "note").length;
  const other = nodes.length - notes;
  const parts: string[] = [];
  if (notes) parts.push(`${notes} note${notes === 1 ? "" : "s"}`);
  if (other) parts.push(`${other} object${other === 1 ? "" : "s"}`);
  return parts.join(", ");
}

/**
 * Removes an uploaded file: the item document, its id in the folder's
 * `itemIds`, and the bytes.
 *
 * The Storage object is deleted on a best-effort basis — if the bucket says
 * no (already gone, or a permission gap), the Firestore rows still go, because
 * an item pointing at nothing is worse than an unreferenced object.
 */
export async function deleteFolderFile(itemId: string): Promise<void> {
  const db = adminDb();
  const snapshot = await db.collection(COLLECTIONS.items).doc(itemId).get();
  if (!snapshot.exists) return;

  const data = snapshot.data() as FolderItem & { storagePath?: string };
  const batch = db.batch();
  unlinkItemFromFolder(batch, { id: itemId, folderId: data.folderId });
  await batch.commit();

  if (data.storagePath) {
    try {
      await adminBucket().file(data.storagePath).delete();
    } catch (cause) {
      console.error("[storage] couldn't delete", data.storagePath, cause);
    }
  }
}

/**
 * First lines for documents whose item row has no `preview` yet — everything
 * saved before the folder listing started showing one.
 *
 * One `getAll` for the batch rather than a read per row, and only for the
 * documents actually missing it, so this costs nothing once a document has
 * been saved (which writes the preview) and nothing at all for a folder of
 * boards and files.
 */
export async function getDocumentPreviews(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const db = adminDb();
  const snapshots = await db.getAll(
    ...ids.map((id) => db.collection(COLLECTIONS.documents).doc(id)),
  );

  const previews: Record<string, string> = {};
  for (const snapshot of snapshots) {
    const doc = snapshot.data() as KDocument | undefined;
    if (!doc) continue;

    const preview =
      documentKind(doc) === "canvas"
        ? canvasPreview(doc.nodes ?? [])
        : docPreview(docBlocksOf(doc));
    if (preview) previews[snapshot.id] = preview.slice(0, 200);
  }
  return previews;
}

export async function getEmbedUrls(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const db = adminDb();
  const snapshots = await db.getAll(
    ...ids.map((id) => db.collection(COLLECTIONS.embeds).doc(id)),
  );

  const urls: Record<string, string> = {};
  for (const snapshot of snapshots) {
    const embed = snapshot.data() as Embed | undefined;
    if (embed?.url) urls[snapshot.id] = embed.url;
  }
  return urls;
}

/** One item row by id — the folder listing's row menu has nothing else. */
export async function getFolderItem(id: string): Promise<FolderItem | undefined> {
  const item = await one<FolderItem & { downloadUrl?: string }>(COLLECTIONS.items, id);
  return item ? withFileUrl(item) : undefined;
}

export async function deleteEmbed(embedId: string): Promise<void> {
  const embed = await getEmbed(embedId);
  if (!embed) return;

  const db = adminDb();
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.embeds).doc(embedId));
  unlinkItemFromFolder(batch, { id: embedId, folderId: embed.folderId });
  await batch.commit();
}

export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await getDocument(documentId);
  if (!doc) return;

  const db = adminDb();
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.documents).doc(documentId));
  unlinkItemFromFolder(batch, { id: documentId, folderId: doc.folderId });
  await batch.commit();
}

/**
 * Backs both the Embed and Link rows in the Create panel.
 *
 * The domain model has no `link` kind — `ItemKind` stops at embed — so a Link
 * is stored as an embed whose provider says so. The distinction the menu draws
 * (embedded app vs. external resource) is therefore presentational only. Give
 * Link its own kind if it ever needs to render differently.
 */
export async function createEmbed(input: {
  folderId: string;
  name: string;
  url: string;
  provider: string;
  authorId: string;
}): Promise<Embed> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.embeds).doc();

  const embed: Embed = {
    id: doc.id,
    name: input.name,
    folderId: input.folderId,
    url: input.url,
    provider: input.provider,
  };

  const batch = db.batch();
  batch.set(doc, withoutId(embed));
  linkItemIntoFolder(batch, {
    id: doc.id,
    kind: "embed",
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    meta: { type: "embed", provider: input.provider },
  });
  await batch.commit();

  return embed;
}

/**
 * Adds a client to the workspace directory.
 *
 * A client is a Person with `kind: "client"` — there's no separate collection.
 * They have no `uid` until they sign in with a matching email, at which point
 * `getCurrentUser` adopts this document rather than provisioning a new one.
 */
export async function createClient(input: {
  name: string;
  email: string;
  /** The tenant this client belongs to — the actual access boundary. */
  organizationId: string;
  /** Set when the create flow was opened from inside a folder. Cosmetic only
   * (sidebar linkage) — access is governed by `organizationId`. */
  folderId?: string;
}): Promise<Person> {
  const doc = adminDb().collection(COLLECTIONS.people).doc();

  const person: Person = {
    id: doc.id,
    name: input.name,
    handle: (input.email.split("@")[0] || input.name).toLowerCase(),
    email: input.email,
    initials: initialsFrom(input.name),
    color:
      PERSON_COLORS[
        Math.abs(
          [...doc.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
        ) % PERSON_COLORS.length
      ],
    kind: "client",
    organizationId: input.organizationId,
    ...(input.folderId ? { folderId: input.folderId } : {}),
  };

  await doc.set(withoutId(person));
  return person;
}

/**
 * Adds an agency member to the workspace directory.
 *
 * The mirror of `createClient` above, and deliberately the same shape: a
 * member is also just a Person, also has no `uid` until first sign-in, and is
 * also adopted by `getCurrentUser` on the email match. The only differences
 * are `kind` and that a member belongs to the workspace rather than to one
 * organization — hence no `organizationId`.
 *
 * With `provisionPerson` gone, this and `createClient` are the only two ways
 * a Person is ever born outside the seed script.
 */
export async function createMember(input: {
  name: string;
  email: string;
  memberRole: MemberRole;
}): Promise<Person> {
  const doc = adminDb().collection(COLLECTIONS.people).doc();

  const person: Person = {
    id: doc.id,
    name: input.name,
    handle: (input.email.split("@")[0] || input.name).toLowerCase(),
    email: input.email,
    initials: initialsFrom(input.name),
    color: tintFor(doc.id),
    kind: "member",
    memberRole: input.memberRole,
  };

  await doc.set(withoutId(person));
  return person;
}

export async function setMemberRole(
  personId: string,
  role: MemberRole,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.people)
    .doc(personId)
    .set({ memberRole: role }, { merge: true });
}

/**
 * Ownership moves as one write. Two `setMemberRole` calls would leave a
 * window with two owners (or, if the second failed, none at all) — a batch
 * makes the transfer atomic.
 */
export async function transferOwnership(input: {
  fromPersonId: string;
  toPersonId: string;
}): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  batch.set(
    db.collection(COLLECTIONS.people).doc(input.toPersonId),
    { memberRole: "owner" },
    { merge: true },
  );
  batch.set(
    db.collection(COLLECTIONS.people).doc(input.fromPersonId),
    { memberRole: "admin" },
    { merge: true },
  );
  await batch.commit();
}

/**
 * Removal, as a soft delete — see `Person.deactivatedAt` for why the document
 * survives. Revoking their Firebase session is the caller's job
 * (`removeMemberAction`), since this module doesn't reach into auth.
 */
export async function deactivateMember(personId: string): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.people)
    .doc(personId)
    .set({ deactivatedAt: new Date().toISOString() }, { merge: true });
}

export async function reactivateMember(personId: string): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.people)
    .doc(personId)
    .update({ deactivatedAt: FieldValue.delete() });
}

/** An invite link is valid for a week, member and client alike. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Exactly one of `organizationId` (client) and `memberRole` (agency member)
 * should be set — that pair is what `acceptInviteAction` branches on to work
 * out where the invitee lands. Both are spread conditionally because
 * Firestore rejects an explicit `undefined`.
 */
export async function createInvite(input: {
  personId: string;
  organizationId?: string;
  memberRole?: MemberRole;
  email: string;
  invitedByPersonId?: string;
}): Promise<Invite> {
  const doc = adminDb().collection(COLLECTIONS.invites).doc();
  const now = new Date();
  const invite: Invite = {
    id: doc.id,
    token: randomUUID(),
    personId: input.personId,
    email: input.email,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.memberRole ? { memberRole: input.memberRole } : {}),
    ...(input.invitedByPersonId ? { invitedByPersonId: input.invitedByPersonId } : {}),
  };

  await doc.set(withoutId(invite));
  return invite;
}

export async function getInviteByToken(token: string): Promise<Invite | undefined> {
  const matches = await many<Invite>(
    collection(COLLECTIONS.invites).where("token", "==", token).limit(1),
  );
  return matches[0];
}

/**
 * Plain function, not a component — the React Compiler lint rule rejects
 * `Date.now()` reachable from render, so this check lives here rather than
 * inline in the invite page.
 */
export function isInviteExpired(invite: Invite): boolean {
  return new Date(invite.expiresAt).getTime() < Date.now();
}

export async function markInviteUsed(inviteId: string): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.invites)
    .doc(inviteId)
    .set({ usedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Two straight equality filters on different fields — Firestore satisfies
 * this without a composite index (that's only required once an inequality
 * or an orderBy on a different field joins the mix), so nothing needed
 * adding to firestore.indexes.json for this one.
 */
export async function getClientsInFolder(folderId: string): Promise<Person[]> {
  return many<Person>(
    collection(COLLECTIONS.people)
      .where("kind", "==", "client")
      .where("folderId", "==", folderId),
  );
}

/* ---- board cards ------------------------------------------------------- */

/**
 * Cards live nested two levels deep — `Board.columns[i].cards[j]` — so there's
 * no Firestore field path that can address one directly. `arrayUnion` only
 * reaches a top-level array field; `columns` itself is one, but the cards
 * array inside a specific column element is not addressable at all once it's
 * nested inside that outer array.
 *
 * So every card mutation is read-modify-write: fetch the board, transform the
 * in-memory `columns` array, write the whole array back with a single field
 * update. That's a real race if two people edit the same board at once — this
 * app has no realtime sync yet, so it's the same risk every read-then-write
 * flow here already carries, not a new one.
 */
/**
 * Returns the columns as they were *before* the mutation, not after — a
 * caller that needs to know what was removed (deleting a column full of
 * cards needs its card count to adjust `bumpBoardCardCount`) can diff
 * against this without a second read.
 */
async function mutateBoardColumns(
  boardId: string,
  mutate: (columns: BoardColumn[]) => BoardColumn[],
): Promise<BoardColumn[]> {
  const ref = adminDb().collection(COLLECTIONS.boards).doc(boardId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Board not found.");

  const board = hydrate<Board>(doc);
  await ref.update({ columns: mutate(board.columns) });
  return board.columns;
}

/** Keeps the folder item's card count in step with the board's actual cards. */
async function bumpBoardCardCount(boardId: string, delta: number): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.items)
    .doc(boardId)
    .set(
      { meta: { type: "board", cardCount: FieldValue.increment(delta) } },
      { merge: true },
    );
}

export async function createCard(input: {
  boardId: string;
  columnId: string;
  authorId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
}): Promise<BoardCard> {
  const card: BoardCard = {
    id: randomUUID(),
    title: input.title,
    authorId: input.authorId,
    createdAt: new Date().toISOString(),
    ...(input.description ? { description: input.description } : {}),
    ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.labels?.length ? { labels: input.labels } : {}),
  };

  await mutateBoardColumns(input.boardId, (columns) =>
    columns.map((col) =>
      col.id === input.columnId
        ? { ...col, cards: [...col.cards, card] }
        : col,
    ),
  );
  await bumpBoardCardCount(input.boardId, 1);

  return card;
}

/**
 * Full replace for the form fields, not a patch — clearing a field (removing
 * the due date, say) works by omitting it rather than needing a separate
 * "delete this field" signal. `authorId`, `createdAt` and `comments` are
 * carried over from the existing card rather than rebuilt, because none of
 * them are form fields: the edit dialog has no inputs for "who made this" or
 * "what was said in the comments", so silently reconstructing the card from
 * only its own fields would erase both on the very first save.
 */
export async function updateCard(input: {
  boardId: string;
  cardId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
}): Promise<void> {
  await mutateBoardColumns(input.boardId, (columns) =>
    columns.map((col) => ({
      ...col,
      cards: col.cards.map((c): BoardCard =>
        c.id !== input.cardId
          ? c
          : {
              id: c.id,
              title: input.title,
              ...(c.authorId ? { authorId: c.authorId } : {}),
              ...(c.createdAt ? { createdAt: c.createdAt } : {}),
              ...(c.comments?.length ? { comments: c.comments } : {}),
              ...(input.description ? { description: input.description } : {}),
              ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
              ...(input.dueDate ? { dueDate: input.dueDate } : {}),
              ...(input.labels?.length ? { labels: input.labels } : {}),
            },
      ),
    })),
  );
}

/**
 * Appends a comment to a card. Same read-modify-write shape as every other
 * card mutation — see the note on `mutateBoardColumns`.
 */
export async function addCardComment(input: {
  boardId: string;
  cardId: string;
  authorId: string;
  text: string;
}): Promise<BoardCardComment> {
  const comment: BoardCardComment = {
    id: randomUUID(),
    authorId: input.authorId,
    text: input.text,
    createdAt: new Date().toISOString(),
  };

  await mutateBoardColumns(input.boardId, (columns) =>
    columns.map((col) => ({
      ...col,
      cards: col.cards.map((c) =>
        c.id !== input.cardId
          ? c
          : { ...c, comments: [...(c.comments ?? []), comment] },
      ),
    })),
  );

  return comment;
}

/**
 * Moves a card to a column, optionally at a specific position within it.
 *
 * `toIndex` is omitted by the "Move to <column>" menu item, which always
 * appends — there's no position to express from a menu. Drag-and-drop
 * supplies it, since dropping between two cards means something more precise
 * than "put it at the end".
 */
export async function moveCard(input: {
  boardId: string;
  cardId: string;
  toColumnId: string;
  toIndex?: number;
}): Promise<void> {
  await mutateBoardColumns(input.boardId, (columns) => {
    let moved: BoardCard | undefined;
    const withoutCard = columns.map((col) => {
      const found = col.cards.find((c) => c.id === input.cardId);
      if (!found) return col;
      moved = found;
      return { ...col, cards: col.cards.filter((c) => c.id !== input.cardId) };
    });
    if (!moved) return columns; // already gone — nothing to move

    const card = moved;
    return withoutCard.map((col) => {
      if (col.id !== input.toColumnId) return col;
      const cards = [...col.cards];
      const at =
        input.toIndex === undefined
          ? cards.length
          : Math.max(0, Math.min(input.toIndex, cards.length));
      cards.splice(at, 0, card);
      return { ...col, cards };
    });
  });
}

export async function deleteCard(input: {
  boardId: string;
  cardId: string;
}): Promise<void> {
  await mutateBoardColumns(input.boardId, (columns) =>
    columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => c.id !== input.cardId),
    })),
  );
  await bumpBoardCardCount(input.boardId, -1);
}

/* ---- board columns ------------------------------------------------------ */

export async function renameBoardColumn(
  boardId: string,
  columnId: string,
  name: string,
): Promise<void> {
  await mutateBoardColumns(boardId, (columns) =>
    columns.map((col) => (col.id === columnId ? { ...col, name } : col)),
  );
}

export async function addBoardColumn(
  boardId: string,
  name: string,
): Promise<BoardColumn> {
  const column: BoardColumn = { id: randomUUID(), name, cards: [] };
  await mutateBoardColumns(boardId, (columns) => [...columns, column]);
  return column;
}

/**
 * Deleting a column takes its cards with it — there's no "move these
 * somewhere first" step, matching how deleting a card itself works. The
 * caller is expected to have confirmed that with whoever clicked delete;
 * this just needs to keep the board's card count honest afterwards, since
 * `bumpBoardCardCount` has no way to know a whole column's worth of cards
 * just vanished otherwise.
 */
export async function deleteBoardColumn(
  boardId: string,
  columnId: string,
): Promise<void> {
  const previous = await mutateBoardColumns(boardId, (columns) =>
    columns.filter((col) => col.id !== columnId),
  );
  const removed = previous.find((col) => col.id === columnId);
  if (removed?.cards.length) {
    await bumpBoardCardCount(boardId, -removed.cards.length);
  }
}

export async function updateFolderPosition(folderId: string, position: number): Promise<void> {
  const db = adminDb();
  await db.collection(COLLECTIONS.folders).doc(folderId).update({ position });
}

export async function reorderFolderItems(folderId: string, itemIds: string[]): Promise<void> {
  const db = adminDb();
  await db.collection(COLLECTIONS.folders).doc(folderId).update({ itemIds });
}
