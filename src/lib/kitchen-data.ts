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
import { adminAuth, adminDb } from "./firebase/admin";
import { getSessionUser } from "./firebase/session";
import { SWATCH_COLORS } from "./kitchen-format";
import type {
  Block,
  Board,
  BoardCard,
  BoardCardComment,
  BoardColumn,
  Company,
  Conversation,
  ConversationFile,
  Embed,
  Folder,
  FolderAccess,
  FolderItem,
  InboxEntry,
  ItemKind,
  ItemMeta,
  KDocument,
  LibraryFile,
  Message,
  NavFolder,
  Person,
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
  companies: "companies",
  templates: "templates",
  tasks: "tasks",
  inbox: "inbox",
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

export async function getCompany(id: string): Promise<Company | undefined> {
  return one<Company>(COLLECTIONS.companies, id);
}

/* ---- collections ----------------------------------------------------- */

export async function getFolders(): Promise<Folder[]> {
  return many<Folder>(collection(COLLECTIONS.folders).orderBy("name"));
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

export async function getCompanies(): Promise<Company[]> {
  return many<Company>(collection(COLLECTIONS.companies).orderBy("name"));
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

/* ---- relations ------------------------------------------------------- */

/**
 * Ordered by the folder's own `itemIds` rather than by any field on the items:
 * folder contents are hand-arranged, and that order is the folder's data, not
 * the item's.
 */
export async function getFolderItems(folderId: string): Promise<FolderItem[]> {
  const folder = await getFolder(folderId);
  if (!folder) return [];

  const items = await many<FolderItem>(
    collection(COLLECTIONS.items).where("folderId", "==", folderId),
  );
  const byId = new Map(items.map((i) => [i.id, i]));

  return folder.itemIds
    .map((id) => byId.get(id))
    .filter((i): i is FolderItem => i !== undefined);
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
  const [fileItems, folders, conversations] = await Promise.all([
    many<FolderItem>(
      collection(COLLECTIONS.items).where("kind", "==", "file"),
    ),
    getFolders(),
    many<Conversation>(collection(COLLECTIONS.conversations)),
  ]);

  const folderName = new Map(folders.map((f) => [f.id, f.name]));

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
 */
export async function getNavTree(): Promise<NavFolder[]> {
  const folders = await getFolders();
  return Promise.all(
    folders.map(async (folder) => {
      // getFolderItems already carries kind + meta for everything (in the
      // folder's hand-arranged order), which is enough to pick an icon and
      // build an href — except a board's colour, which lives only on the
      // board document. That's the one thing worth a follow-up read.
      const [items, boards] = await Promise.all([
        getFolderItems(folder.id),
        getBoardsInFolder(folder.id),
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
 */
export async function getCurrentUser(): Promise<Person | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const byUid = await many<Person>(
    collection(COLLECTIONS.people).where("uid", "==", session.uid).limit(1),
  );
  if (byUid.length > 0) return byUid[0];

  // First sign-in for someone seeded by email but never linked: adopt them.
  if (session.email) {
    const byEmail = await many<Person>(
      collection(COLLECTIONS.people)
        .where("email", "==", session.email)
        .limit(1),
    );
    if (byEmail.length > 0) {
      await adminDb()
        .collection(COLLECTIONS.people)
        .doc(byEmail[0].id)
        .set({ uid: session.uid }, { merge: true });
      return { ...byEmail[0], uid: session.uid };
    }
  }

  // Authenticated, but nobody in the workspace corresponds to them — which is
  // every account created through /sign-up, since that only ever made a
  // Firebase auth user. Without this, signing up succeeded and then bounced
  // you straight back to sign-in with no explanation.
  //
  // Note what this implies: anyone who can complete the sign-up form gets a
  // workspace identity. That matches what the sign-up page currently offers.
  // To make the workspace invite-only, delete this call and seed people ahead
  // of time — the email-matching branch above is then the only way in.
  return provisionPerson(session);
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

/**
 * Create the Person for a freshly authenticated account.
 *
 * The document id is the auth uid rather than a hand-picked slug like
 * `tosin`: seeded people keep their readable ids, and anyone who signs up
 * gets a collision-free one for free.
 */
async function provisionPerson(session: {
  uid: string;
  email: string | undefined;
}): Promise<Person> {
  const authUser = await adminAuth().getUser(session.uid);
  const email = session.email ?? authUser.email ?? "";
  const name = authUser.displayName?.trim() || email.split("@")[0] || "Member";

  // Deterministic so the same person keeps the same tint across re-provisions.
  const tint =
    PERSON_COLORS[
      Math.abs(
        [...session.uid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
      ) % PERSON_COLORS.length
    ];

  const person: Person = {
    id: session.uid,
    name,
    handle: (email.split("@")[0] || name).toLowerCase(),
    email,
    initials: initialsFrom(name),
    color: tint,
    kind: "member",
    uid: session.uid,
  };

  const { id, ...rest } = person;
  await adminDb().collection(COLLECTIONS.people).doc(id).set(rest, { merge: true });

  return person;
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
}): Promise<Folder> {
  await ensureWorkspace();

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
  };

  await doc.set(withoutId(folder));
  return folder;
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
  await adminDb().collection(COLLECTIONS.folders).doc(folderId).delete();
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
export async function sendMessage(input: {
  conversationId: string;
  authorId: string;
  text: string;
  isNote?: boolean;
}): Promise<Message> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.messages).doc();

  const body: Block[] = input.text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({ b: "p", children: [{ t: "text", v: chunk }] }));

  const message: Message = {
    id: doc.id,
    conversationId: input.conversationId,
    authorId: input.authorId,
    createdAt: new Date().toISOString(),
    body,
    ...(input.isNote ? { isNote: true } : {}),
  };

  const batch = db.batch();
  batch.set(doc, withoutId(message));
  // The conversation's folder item carries a messageCount for the folder list.
  batch.set(
    db.collection(COLLECTIONS.items).doc(input.conversationId),
    { meta: { type: "conversation", messageCount: FieldValue.increment(1) } },
    { merge: true },
  );
  await batch.commit();

  return message;
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

export async function createDocument(input: {
  folderId: string;
  name: string;
  authorId: string;
}): Promise<KDocument> {
  const db = adminDb();
  const doc = db.collection(COLLECTIONS.documents).doc();
  const now = new Date().toISOString();

  const document: KDocument = {
    id: doc.id,
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    updatedAt: now,
    blocks: [],
  };

  const batch = db.batch();
  batch.set(doc, withoutId(document));
  linkItemIntoFolder(batch, {
    id: doc.id,
    kind: "document",
    name: input.name,
    folderId: input.folderId,
    authorId: input.authorId,
    meta: { type: "document", updatedAt: now },
  });
  await batch.commit();

  return document;
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
  };

  await doc.set(withoutId(person));
  return person;
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
