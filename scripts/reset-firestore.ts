/**
 * Empties every collection this app owns, after writing a JSON backup.
 *
 *   npm run reset              # dry run — counts what would go, deletes nothing
 *   npm run reset -- --yes     # actually delete
 *
 * The backup is not optional and not a flag. This database has Point-in-Time
 * Recovery disabled, so a delete is otherwise unrecoverable, and the backup
 * costs one read per document that's about to be read anyway.
 *
 * Restoring is `npm run seed -- --force` for seeded content, or hand-feeding
 * the backup JSON back through the Admin SDK for anything added since.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { adminDb } from "../src/lib/firebase/admin";

/** Every collection the app writes. Anything else is left untouched. */
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
];

const confirmed = process.argv.includes("--yes");

async function main() {
  const db = adminDb();
  const backup: Record<string, Array<Record<string, unknown>>> = {};
  let total = 0;

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    backup[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    total += snap.size;
    if (snap.size > 0) console.log(`  ${name.padEnd(14)} ${snap.size}`);
  }

  if (total === 0) {
    console.log("Nothing to delete — every collection is already empty.");
    return;
  }

  mkdirSync("backups", { recursive: true });
  const path = `backups/firestore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify(backup, null, 2));
  console.log(`\nBacked up ${total} documents to ${path}`);

  if (!confirmed) {
    console.log("\nDry run. Re-run with --yes to delete them.");
    return;
  }

  // Batched at 500, Firestore's cap per batched write.
  for (const name of COLLECTIONS) {
    const docs = backup[name];
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + 500)) {
        batch.delete(db.collection(name).doc(doc.id as string));
      }
      await batch.commit();
    }
  }

  console.log(`Deleted ${total} documents.`);
  console.log(
    "\nSigned-in accounts keep working: getCurrentUser() provisions a fresh\n" +
      "Person on the next request. The workspace name falls back to\n" +
      '"Workspace" until a workspaces document exists again.',
  );
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
