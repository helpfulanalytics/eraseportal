# Firebase setup

The app reads and writes a real Firebase project. Until the steps below are
done, `npm run dev` compiles but every workspace route redirects to `/sign-in`,
and signing in fails with "Firebase isn't configured."

## Before you start: the network

The Firebase CLI could not reach Google's APIs from the machine this was built
on. The symptom is misleading — the CLI reports

```
Authentication Error: Your credentials are no longer valid.
```

but the actual failure underneath is a TLS handshake that opens and then hangs:

```
Client network socket disconnected before secure TLS connection was established
```

`storage.googleapis.com` and `firebase.google.com` were reachable at the same
moment that `www.googleapis.com` and `firebase.googleapis.com` were not, and it
failed identically inside and outside the tool sandbox. The machine had seven
`utun` tunnels up and DNS pointing at `172.20.10.1`, an iPhone Personal Hotspot
gateway.

**If CLI commands hang or report invalid credentials, drop the VPN and get off
the tether before re-authenticating.** Re-running `login --reauth` against a
blocked network just produces the same misleading error.

Quick check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 https://firebase.googleapis.com
```

`000` means still blocked. Any HTTP status means you're through.

## 1. Create the project

```bash
npx -y firebase-tools@latest login:list          # confirm the right account
npx -y firebase-tools@latest projects:create kitchen-replacement \
  --display-name "Kitchen Replacement"
```

`.firebaserc` already points at `kitchen-replacement`. If the id was taken and
you created something else, update that file to match.

## 2. Turn on the three services

Firestore, Auth and Storage each need enabling once, in the console:

- **Firestore** — create the database in production mode. The rules in this
  repo replace the defaults in step 5.
- **Authentication** — enable the Email/Password provider.
- **Storage** — create the default bucket.

## 3. Register a web app and write `.env.local`

```bash
npx -y firebase-tools@latest apps:create web kitchen-web
npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID>
```

Copy `.env.local.example` to `.env.local` and fill in the values from that
output.

Then add a service account for the server half: console → Project settings →
Service accounts → Generate new key, and

```bash
base64 -i service-account.json | pbcopy
```

into `FIREBASE_SERVICE_ACCOUNT_B64`. Base64 because the newlines inside
`private_key` don't survive most env-var plumbing intact. **Don't commit the
JSON file** — `.gitignore` covers `.env*`, not a stray key elsewhere in the
tree.

## 4. Seed the data

```bash
npm run seed
```

Writes the dataset from `src/lib/kitchen-seed.ts` — the original mock data —
into thirteen collections. It refuses to run if `people` is non-empty; use
`npm run seed -- --force` to overwrite seeded documents in place. It never
deletes.

## 5. Deploy rules and indexes

```bash
npm run firebase:rules
```

Pushes `firestore.rules`, `firestore.indexes.json` and `storage.rules`. The
composite index on `messages` is required — conversations won't load without
it, because `getMessages` filters on `conversationId` and orders by `createdAt`.

## 6. Create a user who can actually sign in

Seeded people have no `uid`, so none of them can sign in yet. Create an auth
user whose email matches one of the seeded person documents — `tosin`'s address
in `kitchen-seed.ts` is the obvious choice:

```bash
npx -y firebase-tools@latest auth:import --help   # or just use the console
```

On first sign-in, `getCurrentUser()` finds the person by email and writes the
`uid` onto that document, linking the two permanently. Sign in with an email
that matches no person document and you'll be authenticated but have no
workspace identity — which renders as a redirect back to `/sign-in`.

## What is and isn't wired

Working end to end once the above is done: sign-in, sign-up, password reset,
sign-out, every read on every route, and file upload into a folder.

Not yet: message composer writes, reactions, the Create button, board and
document editing, and search. Those still render as chrome — see
`docs/handoff-1.md`.

## Local development without a project

`npm run firebase:emulators` starts the Auth, Firestore and Storage emulators
on the ports in `firebase.json`. Note that nothing in `src/lib/firebase/`
currently connects to them — wiring `connectFirestoreEmulator` and friends is a
small change to `admin.ts` and `client.ts`, gated on an env flag, and hasn't
been done.
