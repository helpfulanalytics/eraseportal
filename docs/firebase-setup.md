# Firebase setup

**Status: live.** The app reads and writes the `kitchen-replacement` project.
Everything below is done unless marked otherwise.

| | |
|---|---|
| Project ID | `kitchen-replacement` |
| Web app ID | `1:560444193075:web:ba6417108fba2e5fdc2646` |
| Firestore | `(default)`, **nam5** (US multi-region) — permanent, can't be moved |
| Storage bucket | `kitchen-replacement.firebasestorage.app` |
| Auth | Email/Password enabled |
| Console | https://console.firebase.google.com/project/kitchen-replacement |

## Running it

```bash
npm run dev
```

`.env.local` is gitignored and already holds the six `NEXT_PUBLIC_*` values plus
the base64'd service account. **A fresh clone has none of that** — copy
`.env.local.example`, then:

```bash
npx -y firebase-tools@latest apps:sdkconfig WEB \
  1:560444193075:web:ba6417108fba2e5fdc2646 --project kitchen-replacement
```

for the client half, and console → Project settings → Service accounts →
Generate new key for the server half, base64'd:

```bash
base64 -i service-account.json | pbcopy
```

Base64 because the newlines inside `private_key` don't survive most env-var
plumbing intact. Delete the JSON afterwards — it bypasses every security rule.

## Signing in

Auth identity and workspace identity are separate: Firebase knows a uid, the
workspace knows a `Person`. They're joined by the `uid` field on the person
document, which `getCurrentUser()` writes on first sign-in by matching email.

An account exists for `victorvoca16@gmail.com`, already linked to the `tosin`
person document. Signing in with an email that matches no person document
leaves you authenticated but without a workspace identity, which renders as a
redirect back to `/sign-in`.

To add someone, create the auth user with a matching email — the link happens
by itself.

## Seeding

```bash
npm run seed              # refuses if `people` is non-empty
npm run seed -- --force   # overwrite seeded documents in place
```

58 documents across 13 collections, keyed by domain id so a re-seed restores
rather than duplicates. It never deletes: a hand-added document survives.

**As of 2026-07-28 the live database is no longer in this seeded state** — it
holds real data from manual testing (workspaces:1, people:2, folders:3,
items:8, conversations:2, messages:1, boards:2, documents:1, embeds:3).
Don't run `--force` or the reset script without checking with whoever's data
is in there.

## Rules and indexes

```bash
npm run firebase:rules
```

Deploys `firestore.rules`, `firestore.indexes.json` and `storage.rules`.

The composite index on `messages` (`conversationId` + `createdAt`) is
**required** — conversations won't load without it, because `getMessages`
filters on one field and orders by another.

Firestore rules are default-deny by design: all reads go through the Admin SDK
on the server, which bypasses rules entirely, so nothing legitimate ever
reaches them. Storage rules are the load-bearing ones — the browser uploads
directly to the bucket.

## A trap worth knowing

**Firestore cannot store an array directly inside another array**, and fails
with `Property array contains an invalid nested entity`. The `ul` block's
`items` was originally `Inline[][]` and could not be written at all. It's now
`Array<{ children: Inline[] }>`, built by the `ul()` helper in
`kitchen-seed.ts`. If you add a block type, keep arrays one level deep.

To check any data before writing it:

```
walk the object; flag any array whose parent is also an array
```

## What is and isn't wired

See [`handoff-2.md`](./handoff-2.md) for the current, detailed breakdown —
this section is a summary and will drift if only this file gets updated.

Working end to end: sign-in, sign-up, password reset, sign-out, every read on
every route, file upload into a folder, message composer writes, the folder
Create button, folder/board/conversation create-rename-delete, board colour
and column CRUD, card CRUD with drag-and-drop and comments, folder colour and
cover image, and linking a client to a folder.

Not wired: message reactions/reply, Share dialog persistence, document
editing, real search, task creation (only completion-toggle exists), and
enforcement of `Folder.access` / `Message.isNote` (both are stored but
nothing reads them on the query path).

## Emulators

`npm run firebase:emulators` starts Auth, Firestore and Storage on the ports in
`firebase.json`. Nothing in `src/lib/firebase/` connects to them yet — wiring
`connectFirestoreEmulator` and friends behind an env flag is a small change to
`admin.ts` and `client.ts`, and hasn't been done.

## Appendix: the network failure during setup

For a long stretch, every Firebase CLI command failed with
`Authentication Error: Your credentials are no longer valid`. That message was
misleading. The real cause was that `firebase.googleapis.com`,
`serviceusage.googleapis.com` and `identitytoolkit.googleapis.com` were
unreachable while other Google hosts answered fine.

Ruled out along the way: VPN (none was connected), DNS tampering (system,
Cloudflare and Google resolvers all returned identical addresses), MTU (500-byte
pings dropped where 1372 succeeded elsewhere), and IPv6 (same hostnames failed
on both families). Traceroute showed packets dying immediately after the
gateway for the affected range while reaching Google's edge for others — an
upstream carrier path problem that later cleared on its own.

If CLI commands start hanging or reporting invalid credentials again, test
reachability before re-authenticating:

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 https://firebase.googleapis.com
```

`000` means the network, not your credentials.
