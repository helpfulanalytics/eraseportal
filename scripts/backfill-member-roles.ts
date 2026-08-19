/**
 * One-time migration for the pre-tiers database: stamps `memberRole` onto
 * every `people` doc with `kind: "member"` that doesn't have one, and
 * promotes exactly one of them to `owner`.
 *
 *   npm run backfill-member-roles -- --owner=someone@example.com          # dry run
 *   npm run backfill-member-roles -- --owner=someone@example.com --yes    # actually writes
 *
 * Everyone else becomes `admin`, matching the fallback `memberRoleOf()` in
 * `permissions.ts` already applies at read time. So this script changes no
 * behaviour for existing members — it makes the implicit default explicit,
 * and adds the one owner that `permissions.ts` deliberately can't invent
 * (nothing in a Person distinguishes which member *should* be owner).
 *
 * Why an owner is required: with self-serve sign-up closed, `/team` is the
 * only way to invite anyone, and `canManageTeam` gates it. A workspace with
 * no owner still works — admins can invite members — but nobody can ever
 * grant or revoke the `owner` tier again without running this.
 *
 * Idempotent: a member who already has a `memberRole` is left alone, so a
 * second run is a no-op rather than a reset. Pass `--force-owner` to move the
 * owner seat onto someone who already has a role.
 *
 * **Do not run this against the live project without checking with the user
 * first.** Same caveat as `backfill-organizations.ts`: this repository's
 * Firestore project holds real data from manual testing, not the seeded
 * fixture set.
 */
import { adminDb } from "../src/lib/firebase/admin";
import type { MemberRole, Person } from "../src/lib/kitchen-types";

const write = process.argv.includes("--yes");
const forceOwner = process.argv.includes("--force-owner");
const ownerArg = process.argv.find((a) => a.startsWith("--owner="));
const ownerEmail = ownerArg?.slice("--owner=".length).trim().toLowerCase();

async function main() {
  const db = adminDb();

  const peopleSnap = await db.collection("people").get();
  const members = peopleSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Person)
    .filter((p) => p.kind === "member");

  if (members.length === 0) {
    console.log("No members found — nothing to backfill.");
    return;
  }

  if (!ownerEmail) {
    console.error(
      "Refusing to run without --owner=<email>. Pick which member holds the owner seat:\n",
    );
    for (const m of members) {
      console.error(`  ${m.name} <${m.email}> — ${m.memberRole ?? "(no role)"}`);
    }
    process.exit(1);
  }

  const owner = members.find((m) => m.email.toLowerCase() === ownerEmail);
  if (!owner) {
    console.error(`No member with email ${ownerEmail}. Candidates:\n`);
    for (const m of members) console.error(`  ${m.name} <${m.email}>`);
    process.exit(1);
  }

  const existingOwners = members.filter(
    (m) => m.memberRole === "owner" && m.id !== owner.id,
  );
  if (existingOwners.length > 0 && !forceOwner) {
    console.error(
      `Someone already holds the owner seat: ${existingOwners
        .map((m) => `${m.name} <${m.email}>`)
        .join(", ")}.\n` +
        "Re-run with --force-owner to move it, or use the Team page's transfer instead.",
    );
    process.exit(1);
  }

  console.log(`Found ${members.length} member(s):\n`);

  const batch = db.batch();
  let planned = 0;

  for (const member of members) {
    const isOwner = member.id === owner.id;
    const next: MemberRole = isOwner ? "owner" : "admin";

    if (member.memberRole === next) {
      console.log(`  ${member.name} <${member.email}> — already ${next}, skipping`);
      continue;
    }
    // An explicitly-set role is a decision someone made; only the owner
    // promotion is allowed to overwrite one, and only with --force-owner.
    if (member.memberRole && !(isOwner && forceOwner)) {
      console.log(
        `  ${member.name} <${member.email}> — has ${member.memberRole}, leaving alone`,
      );
      continue;
    }

    console.log(
      `  ${member.name} <${member.email}> — ${member.memberRole ?? "(no role)"} -> ${next}`,
    );
    planned += 1;

    if (write) {
      batch.set(
        db.collection("people").doc(member.id),
        { memberRole: next },
        { merge: true },
      );
    }
  }

  console.log(`\n${planned} member(s) ${write ? "written" : "would be written"}.`);
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
