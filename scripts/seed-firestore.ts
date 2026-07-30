/**
 * Writes the mock dataset into Firestore.
 *
 *   npm run seed              # refuses if anything is already there
 *   npm run seed -- --force   # overwrites documents with matching ids
 *
 * Idempotent by id: re-running with --force restores every seeded document to
 * its original state without duplicating anything, because each document is
 * keyed by its domain id rather than an auto-generated one.
 *
 * It does not delete. A document you added by hand survives a re-seed, and a
 * collection this script doesn't know about is left alone.
 */
import { adminDb } from "../src/lib/firebase/admin";
import {
  BOARDS,
  CONVERSATIONS,
  DOCUMENTS,
  EMBEDS,
  FOLDERS,
  FOLDER_ITEMS,
  INBOX,
  MESSAGES,
  ORGANIZATIONS,
  PEOPLE,
  TASKS,
  TEMPLATES,
  WORKSPACE,
} from "../src/lib/kitchen-seed";

/**
 * Credentials come from `--env-file=.env.local`, which the npm script passes.
 * Running this file directly with no env file will fail in `adminDb()` with a
 * credentials error rather than writing anywhere unexpected.
 */
const force = process.argv.includes("--force");

/** Firestore rejects `undefined`; optional fields simply shouldn't be written. */
function strip<T extends Record<string, unknown>>(doc: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(doc).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Writes in batches of 500 — Firestore's hard cap per batched write. MESSAGES
 * is the only collection near it today, but it's the collection most likely to
 * grow.
 */
async function seed<T extends { id: string }>(
  collection: string,
  docs: T[],
): Promise<number> {
  const db = adminDb();
  let written = 0;

  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const batch = db.batch();

    for (const doc of chunk) {
      const { id, ...rest } = doc;
      batch.set(db.collection(collection).doc(id), strip(rest), {
        merge: !force,
      });
      written += 1;
    }

    await batch.commit();
  }

  console.log(`  ${collection.padEnd(16)} ${written}`);
  return written;
}

async function main() {
  const db = adminDb();

  // Guard against seeding on top of real data. One probe is enough: the app
  // can't function without people, so a populated workspace always has some.
  if (!force) {
    const existing = await db.collection("people").limit(1).get();
    if (!existing.empty) {
      console.error(
        "Firestore already has data. Re-run with --force to overwrite the\n" +
          "seeded documents, or point at an empty project.",
      );
      process.exit(1);
    }
  }

  console.log(
    `Seeding ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}${force ? " (force)" : ""}\n`,
  );

  const total =
    (await seed("workspaces", [WORKSPACE])) +
    (await seed("people", Object.values(PEOPLE))) +
    (await seed("folders", FOLDERS)) +
    (await seed("items", FOLDER_ITEMS)) +
    (await seed("conversations", CONVERSATIONS)) +
    (await seed("messages", MESSAGES)) +
    (await seed("boards", BOARDS)) +
    (await seed("documents", DOCUMENTS)) +
    (await seed("embeds", EMBEDS)) +
    (await seed("organizations", ORGANIZATIONS)) +
    (await seed("templates", TEMPLATES)) +
    (await seed("tasks", TASKS)) +
    (await seed("inbox", INBOX));

  console.log(`\n${total} documents written.`);
  console.log(
    "\nNo one can sign in yet: seeded people have no `uid`. Create an auth\n" +
      "user whose email matches a person document — getCurrentUser() links\n" +
      "the two on first sign-in.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
