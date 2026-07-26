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
import { adminDb } from "./firebase/admin";
import { getSessionUser } from "./firebase/session";
import type {
  Board,
  Company,
  Conversation,
  ConversationFile,
  Embed,
  Folder,
  FolderItem,
  InboxEntry,
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
    folders.map(async (folder) => ({
      id: folder.id,
      name: folder.name,
      conversations: (await getConversationsInFolder(folder.id)).map((c) => ({
        id: c.id,
        name: c.name,
      })),
    })),
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

  return null;
}
