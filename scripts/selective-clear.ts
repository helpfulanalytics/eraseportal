import { mkdirSync, writeFileSync } from "node:fs";
import { adminDb } from "../src/lib/firebase/admin";

const COLLECTIONS = [
  "workspaces",
  "people",
  "folders",
  "items",
  "conversations",
  "messages",
  "boards",
  "documents",
  "embeds",
  "organizations",
  "templates",
  "tasks",
  "inbox",
  "invites"
];

const KEEP_EMAIL = "allioluwatosin8@gmail.com";

async function main() {
  const db = adminDb();
  
  // Find the user to keep
  const peopleSnap = await db.collection("people").where("email", "==", KEEP_EMAIL).get();
  const keepUserIds = new Set<string>();
  
  if (!peopleSnap.empty) {
    peopleSnap.docs.forEach(doc => {
      keepUserIds.add(doc.id);
      console.log(`Found user to keep: ${doc.id} (${KEEP_EMAIL})`);
    });
  } else {
    console.log(`Warning: User with email ${KEEP_EMAIL} not found. They will not be preserved.`);
  }

  // Backup all data
  const backup: Record<string, Array<Record<string, unknown>>> = {};
  let totalToDelete = 0;
  let totalKept = 0;

  const docsToDelete: { collection: string, id: string }[] = [];

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    backup[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    for (const doc of snap.docs) {
      if (name === "people" && keepUserIds.has(doc.id)) {
        totalKept++;
        continue; // Skip deleting this user
      }
      // Delete everything else
      docsToDelete.push({ collection: name, id: doc.id });
      totalToDelete++;
    }
    
    if (snap.size > 0) console.log(`  ${name.padEnd(14)} ${snap.size}`);
  }

  if (totalToDelete === 0) {
    console.log("Nothing to delete.");
    return;
  }

  // Write backup
  mkdirSync("backups", { recursive: true });
  const path = `backups/firestore-selective-clear-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify(backup, null, 2));
  console.log(`\nBacked up all ${totalToDelete + totalKept} documents to ${path}`);

  // We require a confirmation flag to actually delete
  if (!process.argv.includes("--yes")) {
    console.log(`\nDry run. Found ${totalToDelete} documents to delete and ${totalKept} documents to keep.`);
    console.log("Re-run with --yes to execute the deletion.");
    return;
  }

  // Batch delete
  for (let i = 0; i < docsToDelete.length; i += 500) {
    const batch = db.batch();
    for (const docInfo of docsToDelete.slice(i, i + 500)) {
      batch.delete(db.collection(docInfo.collection).doc(docInfo.id));
    }
    await batch.commit();
  }

  console.log(`\nSuccessfully deleted ${totalToDelete} documents.`);
  console.log(`Kept ${totalKept} document(s) matching ${KEEP_EMAIL}.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
