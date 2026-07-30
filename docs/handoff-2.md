# Handoff 2 — kitchen-replacement

Written 2026-07-28, end of the "make it real" stage. Supersedes
[`handoff-1.md`](./handoff-1.md), whose central premise (mock data, no
backend) stopped being true two work stages ago. Read
[`kitchen-scan.md`](./kitchen-scan.md) first regardless — it's still the
design/object-model source of truth and hasn't changed.

---

## What changed since handoff-1

Everything. The app went from a static UI on typed mock constants to a
Firebase-backed app with working auth and almost every piece of "chrome
without function" wired up. In commit order (`git log` has the full list):

- Data layer moved from mock constants to Firestore (`a956429`)
- Auth, Storage uploads, security rules, seed script (`21b30a3`)
- Sign-up/sign-in/redirect flow completed, Person-on-first-sign-in (`fb3ea75`,
  `637f391`)
- Firestore reset script, mock data emptied (`6c15177`)
- Workspace made writable: create, send, complete (`4dcbc3a`)
- Create panel and Create Folder dialog ported and made functional
  (`d40855f`, `aad928b`, `1395a52`)
- Board: card CRUD, boards show in the sidebar tree (`7e118b2`)
- Base UI `DropdownMenuLabel` crash fixed (`0bab91f`)
- Board made draggable (`@dnd-kit`), cards open a full Trello-style detail
  view with comments (`66343a2`, `dd0e97e`, `c61c21c`)
- Board rename/delete (`d096fb8`)
- Board colour, list (column) CRUD, folder rename/delete, conversation
  rename/delete (`471444a`)
- Sidebar shows every folder item kind (not just boards/conversations);
  folder colour and cover image (`dc4fe55`)
- A client can be linked to one folder, shown in the sidebar (`5403393`)

## Current state

`npm run build`, `npm run lint`, and `tsc --noEmit` are clean as of the last
commit. Auth, all reads, and the mutations listed below have been exercised
against the live `kitchen-replacement` Firestore project, not just
type-checked.

**Working end-to-end (backed by real writes, not just UI):**
- Sign-in, sign-up, password reset, sign-out
- Folder create, rename, delete (delete refuses if the folder still has
  items — move or delete them first)
- Folder colour (one of 5 `SWATCH_COLORS`) and cover image upload
- Board create, rename, delete, colour
- Board columns (lists): rename, add, delete — delete correctly decrements
  the board's cached card count
- Board cards: create, edit (title/description/assignee/due date/labels),
  drag-and-drop between columns, delete, comment
- Conversation create, rename, delete; message send (composer actually
  persists and appends now — it didn't in handoff-1)
- File upload into a folder, and folder cover image (same Storage prefix,
  see Traps)
- Client create, and linking a client to at most one folder (via
  `Person.folderId`); the sidebar shows linked clients under their folder
- Sidebar folder tree: shows every item kind (conversation, board, document,
  embed, link — not just the original two), tinted by folder/board colour
- Task completion toggle (`/tasks`, `/tasks/me`)

**Still chrome without function** (unchanged from handoff-1 unless noted):
- Global search (⌘K) opens and dismisses but has no index — see
  `src/components/shell/global-search.tsx`
- Message reactions, reply, "more" menu on individual messages
- Share dialog is real UI, stores nothing except Copy Link
- Document editing (documents are read-only viewers)
- Task creation — `getTasks`/`setTaskCompleted` exist; nothing creates a
  `Task` document yet, so `/tasks` only ever shows what was seeded
- `Folder.access` / `FolderAccess` and `Message.isNote` are stored but not
  enforced — every signed-in user sees every folder and every note
- Board column reordering (list order is creation order, not draggable)
- Invoice — explicitly out of scope per the user; not built

**Not built at all:** mobile breakpoints, real search index, Inbox
right-hand reading pane, emulator wiring (see `firebase-setup.md`).

**Live data note:** the Firestore project is no longer empty or in its
freshly-seeded state — it holds real data from manual testing during this
stage (3 folders, 2 boards, 2 conversations, 8 items, etc., as of this
writing). Don't run `npm run reset` or `npm run seed -- --force` without
checking with the user first; that data may be worth keeping.

### Routes

Unchanged in shape from handoff-1 — no new top-level routes were added this
stage, only new interactions on existing ones. See handoff-1's route table
if you need it; it's still accurate.

### Layout of the source

```
src/app/(workspace)/actions.ts   every server action — folder/board/column/
                                  conversation/card/client mutations
src/app/(workspace)/             routes; wrapped in <AppShell>
src/app/(auth)/                  auth pages
src/components/shell/            app-shell, sidebar (now kind-aware), global-search
src/components/kitchen/          board-*, folder-header-controls, folder-cover-button,
                                  conversation-header-controls, create-item-dialog,
                                  create-menu, dialog-shell, and the rest
src/lib/kitchen-types.ts         types only — no I/O, importable from client components
src/lib/kitchen-data.ts          Firestore accessors + mutations (server-only, large)
src/lib/kitchen-format.ts        SWATCH_COLORS and other display helpers
src/lib/firebase/                admin.ts (server), client.ts, storage.ts (browser upload)
src/lib/kitchen-seed.ts          seed script content + ul()/block helpers
video/                           separate Remotion launch-video project — see below
```

---

## Traps — carried forward from handoff-1, plus new ones from this stage

Handoff-1's five traps (tailwind-merge eating custom font sizes, Next 16
async params, no setState-in-effect, the 14px type ceiling, alpha-ramp
colours) still apply unchanged — not repeating them here, see
[`handoff-1.md`](./handoff-1.md) if you need the detail.

New this stage:

### 6. Firestore rejects an array directly inside an array

Already documented in `firebase-setup.md`, restated here because it shapes
any new nested-list feature: `Inline[][]` cannot be stored. Wrap each item in
a map, e.g. `Array<{ children: Inline[] }>` (see the `ul` block).

### 7. Base UI's `DropdownMenuLabel` needs a `DropdownMenuGroup` ancestor

Crashes at runtime otherwise — not a type error, a thrown exception on open.
Every `⋯` menu that groups a label with content in this codebase (board
colour swatches, folder colour swatches, the account menu) wraps in
`DropdownMenuGroup` for this reason. Copy that shape for new menus.

### 8. Mutation functions that rewrite a sub-object must carry forward every field, not just the ones the form touched

The root cause of a real, shipped bug earlier this stage: `updateCard`
originally rewrote a card from just the edited fields and silently dropped
`authorId`/`createdAt`/`comments`. Any function that does a Firestore
read-modify-write on a nested object (`updateCard`, `renameBoard`,
`setBoardColor`, the board-column helpers) needs to spread the existing
object first, then apply the change — "full replace, not patch."

### 9. `mutateBoardColumns` returns the pre-mutation columns

So a caller that needs to know what was removed (`deleteBoardColumn`, to
diff the card count) doesn't need a second read. If you add a new column
mutation, keep this return-the-old-state contract rather than reverting to
`Promise<void>`.

### 10. Dual-write name fields on Board and Conversation

Both store their `name` twice — on their own document, and again on their
`items` collection row (which the sidebar and folder listing read directly,
without joining back to the board/conversation doc). `renameBoard` and
`renameConversation` write both in one batch. If you add a new renameable
item kind that also appears in `items`, do the same, or the sidebar and the
detail page will disagree after a rename.

### 11. Two straight equality `.where()` filters do not need a composite Firestore index

Confirmed empirically against the live project, not just from docs:
`getClientsInFolder` filters on `kind == "client"` AND `folderId == X` with
no index and it works. Composite indexes are only required for
equality+inequality or equality+`orderBy`-on-a-different-field (the
`messages` index is that second case). Worth re-verifying live if you add a
new two-filter query rather than assuming — an index gap fails at runtime,
not at build time.

### 12. `storage.rules` only matches a flat `folders/{folderId}/{fileId}` path

No subpaths. The folder cover-image upload deliberately reuses the exact
same `folders/{folderId}` prefix as a regular file upload rather than a
cleaner `folders/{folderId}/cover` path, because the rules pattern has
exactly one wildcard segment after `folderId` and would reject anything
nested. If you need a genuinely separate upload location, the rules file
needs a new match block first.

### 13. Client-held optimistic state vs. fresh server props after `revalidatePath`

Several components (`BoardHeader`, `FolderHeaderControls`) hold local state
for instant visual feedback on a colour pick, then must reconcile with the
new server-rendered props once `revalidatePath` finishes. This is done with
a conditional `setState` call in the render body (React's "adjusting state
when a prop changes" pattern) — not inside `useEffect`, which the compiler
lint rule rejects for this. Copy this shape, not a `useEffect`, for new
instant-feedback-then-reconcile UI.

### 14. `eslint-disable-next-line` only disables the literal next line

Bit us once adding the cover-image `<img>` tag: a multi-line comment block
with the disable directive as its *first* line did nothing, because the
"next line" was still a comment. Put the directive as the last line
immediately before the code it's disabling.

---

## Starting the next session

```bash
npm run dev            # localhost:3000
npm run build           # catches async params/searchParams misuse
npm run lint
npx tsc --noEmit
```

Firebase is live and already configured — see `firebase-setup.md` for env
setup on a fresh clone. Don't run `npm run seed -- --force` or the reset
script without checking first: **the database currently holds real data**,
not the seeded fixture set.

### The `video/` directory

Untracked (`git status` shows `?? video/`), 721M on disk, **not yet in
`.gitignore`**. It's a deliberate, separate Remotion-based launch-video
project with its own `package.json`, bundler, and React version — see
`video/README.md`. It is not part of the Next.js app and shouldn't be
treated as such. Two things worth doing early next session, neither done
yet because they were outside this stage's literal scope:
1. Add `video/` (or at least its `node_modules`/`build`/`out`) to
   `.gitignore` before anyone runs a broad `git add`.
2. Confirm with whoever owns it whether it belongs in this repo at all, or
   should move to its own.

### Sensible next moves

1. Gitignore `video/` (above) before it gets swept into a commit by
   accident.
2. Message reactions/reply, and Share-dialog persistence — the largest
   remaining "looks done, isn't" gaps.
3. Enforce `Folder.access` and `Message.isNote` — both are recorded but
   nothing reads them on the query path yet, so private folders and internal
   notes are visible to everyone signed in.
4. Real search index for ⌘K.
5. Task creation UI — the completion toggle exists but nothing writes a new
   `Task` document.
6. Responsive pass — still desktop-only, per handoff-1.
