/**
 * One-time migration for the pre-multi-tenant database: creates an
 * `Organization` for every existing client (a `people` doc with
 * `kind: "client"`, linked to a folder via `Person.folderId` — that's the
 * only signal the old model recorded), then stamps `organizationId` onto
 * that client and their linked folder.
 *
 *   npm run backfill-organizations              # dry run — prints the plan, writes nothing
 *   npm run backfill-organizations -- --yes      # actually writes
 *
 * Clients with no `folderId`, and folders with no linked client, are left
 * alone — they become agency-internal (`organizationId` absent), which is
 * the correct default per `Folder.organizationId`'s doc comment.
 *
 * **Do not run this against the live project without checking with the user
 * first.** It was scoped and reviewed for the migration described in
 * docs/handoff-2's "Live data note", but it has not been run — this
 * repository's Firestore project holds real data from manual testing, not
 * the seeded fixture set.
 */
import { adminDb } from "../src/lib/firebase/admin";
import type { Folder, Organization, Person } from "../src/lib/kitchen-types";

const write = process.argv.includes("--yes");

async function main() {
  const db = adminDb();

  const [peopleSnap, foldersSnap] = await Promise.all([
    db.collection("people").get(),
    db.collection("folders").get(),
  ]);

  const clients = peopleSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Person)
    .filter((p) => p.kind === "client" && p.folderId);

  const folders = new Map(
    foldersSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Folder]),
  );

  if (clients.length === 0) {
    console.log("No folder-linked clients found — nothing to backfill.");
    return;
  }

  console.log(`Found ${clients.length} folder-linked client(s):\n`);

  const batch = db.batch();
  let planned = 0;

  for (const client of clients) {
    const folder = client.folderId ? folders.get(client.folderId) : undefined;
    if (!folder) {
      console.log(`  ${client.name} <${client.email}> — folderId ${client.folderId} not found, skipping`);
      continue;
    }
    if (client.organizationId && folder.organizationId) {
      console.log(`  ${client.name} — already backfilled (org ${client.organizationId}), skipping`);
      continue;
    }

    const orgRef = db.collection("organizations").doc();
    const slugBase = folder.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const organization: Omit<Organization, "id"> = {
      name: folder.name,
      domain:
        client.email.split("@")[1] ??
        folder.name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".example",
      createdAt: new Date().toISOString(),
      slug: `${slugBase || "org"}-${orgRef.id.slice(0, 5)}`,
    };

    console.log(
      `  ${client.name} <${client.email}> + folder "${folder.name}" -> new org "${organization.name}" (${orgRef.id})`,
    );
    planned += 1;

    if (write) {
      batch.set(orgRef, organization);
      batch.set(db.collection("people").doc(client.id), { organizationId: orgRef.id }, { merge: true });
      batch.set(db.collection("folders").doc(folder.id), { organizationId: orgRef.id }, { merge: true });
    }
  }

  console.log(`\n${planned} organization(s) ${write ? "written" : "would be written"}.`);
  if (!write) {
    console.log("Dry run — nothing was written. Re-run with --yes to apply.");
    return;
  }

  await batch.commit();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
