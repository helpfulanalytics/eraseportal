/**
 * One-off import: creates a real CardFlowFinancial folder in production
 * Firestore, populated with the actual conversation history and files
 * scraped from brooksconkle.kitchen.co (the kitchen.co portal being
 * migrated away from).
 *
 * Uses real Firestore auto-generated ids throughout — NOT the placeholder
 * ids from src/lib/kitchen-seed.ts, which are fictional and don't
 * correspond to anything in this project's live data.
 *
 *   npm run import:cardflow-real
 */
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { adminDb, adminBucket } from "../src/lib/firebase/admin";
import type { Folder, FolderItem, Conversation, Message, Person } from "../src/lib/kitchen-types";

const DATA_DIR = join(__dirname, "data-import");
const FILES_DIR = join(DATA_DIR, "files");

/** The real "Cardflow Financial [internal notes]" organization — reused so
 * this client's client-facing folder sits alongside the existing internal
 * one under the same company record. */
const ORGANIZATION_ID = "LllF50NgtomNOGuw0Okn";

/** Real person ids, matched by email against the `people` collection. */
const TOSIN_ID = "EhbrdPZ8aNRWsQViQCbCs5W0KI23";
const BROOKS_ID = "QXs9IsSK38KoSKlPsJ5Z";

interface RawAttachment {
  id: string;
  name: string;
  label: string;
  bytes: number;
  mime?: string;
  _localFile: string;
}

/** authorId in the scraped JSON is one of "tosin" | "brooks" | "chelsea" —
 * remapped below to real person ids once CHELSEA_ID is known. */
interface RawMessage {
  id: string;
  conversationId: string;
  authorId: "tosin" | "brooks" | "chelsea";
  createdAt: string;
  body: Message["body"];
  attachments?: RawAttachment[];
}

function strip<T extends Record<string, unknown>>(doc: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(doc).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

async function uploadFile(
  localPath: string,
  storagePath: string,
  contentType: string,
): Promise<string> {
  const bucket = adminBucket();
  const token = randomUUID();
  const bytes = readFileSync(localPath);
  const file = bucket.file(storagePath);
  await file.save(bytes, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function main() {
  const db = adminDb();
  console.log(`Importing real CardFlowFinancial data into ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

  // Sanity check: confirm the org exists and tosin/brooks resolve as expected.
  const org = await db.collection("organizations").doc(ORGANIZATION_ID).get();
  if (!org.exists) throw new Error(`organization ${ORGANIZATION_ID} not found`);
  const tosin = await db.collection("people").doc(TOSIN_ID).get();
  const brooks = await db.collection("people").doc(BROOKS_ID).get();
  if (tosin.data()?.email !== "allioluwatosin8@gmail.com") throw new Error("tosin id mismatch");
  if (brooks.data()?.email !== "brooks@brooksconkle.com") throw new Error("brooks id mismatch");
  console.log(`  org: ${org.data()?.name}`);

  // 1. Create the Chelsea client person, if not already present.
  const existingChelsea = await db
    .collection("people")
    .where("email", "==", "chelsea@cardflowfinancial.com")
    .limit(1)
    .get();
  let chelseaId: string;
  if (!existingChelsea.empty) {
    chelseaId = existingChelsea.docs[0].id;
    console.log(`  chelsea person already exists: ${chelseaId}`);
  } else {
    const chelseaRef = db.collection("people").doc();
    chelseaId = chelseaRef.id;
    const chelsea: Omit<Person, "id"> = {
      name: "Chelsea Rogers",
      handle: "chelsea",
      email: "chelsea@cardflowfinancial.com",
      initials: "CR",
      color: "var(--k-blue)",
      kind: "client",
      organizationId: ORGANIZATION_ID,
    };
    await chelseaRef.set(strip(chelsea));
    console.log(`  created chelsea person: ${chelseaId}`);
  }

  const AUTHOR_MAP: Record<RawMessage["authorId"], string> = {
    tosin: TOSIN_ID,
    brooks: BROOKS_ID,
    chelsea: chelseaId,
  };

  // 2. Create the folder (real auto-id).
  const folderRef = db.collection("folders").doc();
  const folderId = folderRef.id;
  const coverUrl = await uploadFile(
    join(DATA_DIR, "folder-cover.png"),
    `folders/${folderId}/${randomUUID()}.png`,
    "image/png",
  );
  console.log(`  folder id: ${folderId}`);
  console.log(`  uploaded folder cover -> ${coverUrl}`);

  // 3. Create the conversation (its id doubles as its FolderItem id, matching
  // the pattern already used elsewhere in this project).
  const convRef = db.collection("items").doc();
  const conversationId = convRef.id;

  // 4. Load and remap the scraped messages.
  const rawMessages: RawMessage[] = JSON.parse(
    readFileSync(join(DATA_DIR, "cardflow-messages.json"), "utf8"),
  );

  const messages: Message[] = [];
  for (const raw of rawMessages) {
    const message: Message = {
      id: raw.id,
      conversationId,
      authorId: AUTHOR_MAP[raw.authorId],
      createdAt: raw.createdAt,
      body: raw.body,
    };
    if (raw.attachments && raw.attachments.length > 0) {
      const resolved = [];
      for (const att of raw.attachments) {
        const localPath = join(FILES_DIR, att._localFile);
        const url = await uploadFile(
          localPath,
          `conversations/${conversationId}/${randomUUID()}-${att.name}`,
          att.mime ?? "application/pdf",
        );
        resolved.push({
          id: att.id,
          name: att.name,
          label: att.label,
          bytes: att.bytes,
          mime: att.mime,
          url,
        });
        console.log(`  uploaded attachment ${att.name} -> ${url}`);
      }
      message.attachments = resolved;
    }
    messages.push(message);
  }

  const msgBatch1 = db.batch();
  const msgBatch2 = db.batch();
  messages.forEach((m, i) => {
    const { id, ...rest } = m;
    const batch = i < 40 ? msgBatch1 : msgBatch2;
    batch.set(db.collection("messages").doc(id), strip(rest));
  });
  await msgBatch1.commit();
  await msgBatch2.commit();
  console.log(`  wrote ${messages.length} real messages`);

  const participantIds = [TOSIN_ID, BROOKS_ID, chelseaId];
  const conversation: Omit<Conversation, "id"> = {
    name: "CardFlow - Chelsea / Brooks / Tosin",
    folderId,
    participantIds,
    starred: false,
  };
  await db.collection("conversations").doc(conversationId).set(strip(conversation));

  const conversationItem: Omit<FolderItem, "id"> = {
    kind: "conversation",
    name: "CardFlow - Chelsea / Brooks / Tosin",
    folderId,
    createdAt: rawMessages[0].createdAt,
    authorId: BROOKS_ID,
    meta: { type: "conversation", messageCount: messages.length },
  };
  await convRef.set(strip(conversationItem));
  console.log(`  created conversation ${conversationId} with ${messages.length} messages`);

  // 5. Create the four file items with real uploaded Storage URLs.
  const fileUploads: Array<{
    localFile: string;
    createdAt: string;
    authorId: string;
    bytes: number;
  }> = [
    { localFile: "cardflow-overview.pdf", createdAt: "2026-03-11T00:00:00Z", authorId: chelseaId, bytes: 40696 },
    { localFile: "CardFlow Proposal - Pricing Breakdown.pdf", createdAt: "2026-03-26T00:00:00Z", authorId: BROOKS_ID, bytes: 77454 },
    { localFile: "CardFlow Financial - signed agreement.pdf", createdAt: "2026-04-01T00:00:00Z", authorId: chelseaId, bytes: 90750 },
    { localFile: "milestone_1.pdf", createdAt: "2026-04-03T00:00:00Z", authorId: TOSIN_ID, bytes: 70667 },
  ];

  const fileItemIds: string[] = [];
  for (const { localFile, createdAt, authorId, bytes } of fileUploads) {
    const itemRef = db.collection("items").doc();
    const url = await uploadFile(
      join(FILES_DIR, localFile),
      `folders/${folderId}/${randomUUID()}-${localFile}`,
      "application/pdf",
    );
    const item: Omit<FolderItem, "id"> = {
      kind: "file",
      name: localFile,
      folderId,
      createdAt,
      authorId,
      meta: { type: "file", mime: "application/pdf", label: "PDF", bytes, url },
    };
    await itemRef.set(strip(item));
    fileItemIds.push(itemRef.id);
    console.log(`  created file item ${itemRef.id} (${localFile}) -> ${url}`);
  }

  // 6. Finally, the folder itself, referencing everything created above.
  const folder: Omit<Folder, "id"> = {
    name: "CardFlowFinancial",
    url: "https://www.cardflowfinancial.com/",
    coverUrl,
    starred: false,
    organizationId: ORGANIZATION_ID,
    access: "clients",
    itemIds: [conversationId, ...fileItemIds],
  };
  await folderRef.set(strip(folder));
  console.log(`\nCreated folder "${folder.name}" (${folderId}) with ${folder.itemIds.length} items.`);
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
