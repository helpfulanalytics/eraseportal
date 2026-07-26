# Handoff 1 — kitchen-replacement

Written 2026-07-26, end of the second work stage. Read this plus
[`kitchen-scan.md`](./kitchen-scan.md) before touching anything.

---

## What this project is

A self-hosted replacement for [kitchen.co](https://brooksconkle.kitchen.co) — the
client-facing workspace currently used to run the CardFlow engagement for Kea
Marketing LLC.

**`docs/kitchen-scan.md` is the specification.** It records a live scan of the
real app: object model, layout geometry, all 133 `--k-*` design tokens, a
feature inventory, and an explicit list of what was *not* observed. When in
doubt about how something should look or behave, that file is the source of
truth — not this one.

### Decisions already taken (don't relitigate without asking)

| Decision | Choice |
|---|---|
| Scope | UI-first on typed mock data. **No backend, no auth, no persistence.** |
| Fidelity | Faithful visual clone of Kitchen's tokens |
| Existing code | The old Linear-style agency scaffold was deleted outright |
| Billing | Logged to the `June` tab under the `agency tool` column-B label |

---

## Current state

**Working and verified:** `npm run build` and `npm run lint` are both clean.
All 18 routes return 200; a bad ID 404s correctly.

```
/                                    workspace home (welcome, folders, create cards)
/folders/[folderId]                  cover, title+URL, filter row, item table
/conversations/[conversationId]      thread + composer; ?tab=files
/boards/[boardId]                    kanban
/documents/[documentId]              reading view
/embeds/[embedId]                    sandboxed iframe
/inbox                               two-pane; ?tab=chats|tasks|files|updates
/clients                             ?tab=companies
/tasks                               ?view=&layout=table|calendar&order=
/tasks/me                            /library  /templates  /settings (?tab=)
/sign-in /sign-up /onboarding /reset-password   (auth group, pre-existing stubs)
```

### Layout of the source

```
src/app/(workspace)/     all workspace routes; wrapped in <AppShell>
src/app/(auth)/          untouched auth pages, deliberately outside the shell
src/components/shell/    app-shell, icon-rail, sidebar, global-search
src/components/kitchen/  shared: data-table, page-title, person-avatar,
                         share-dialog, item-top-bar, file-thumb, task-calendar
src/components/conversation/  message-list, composer, rich-text
src/components/ui/       stock shadcn/base-ui primitives — DO NOT restyle these
src/lib/kitchen-data.ts  types + the entire mock dataset + accessors
src/lib/utils.ts         cn() — see the tailwind-merge trap below
```

---

## Traps — read before writing code

### 1. `tailwind-merge` silently eats custom font sizes

The token system **renames Tailwind's font-size scale** (`text-md`, `text-title`,
`text-section`, capped at 14px — see `globals.css`). Stock tailwind-merge doesn't
know these names, classifies them as *colours*, and drops them when a `text-k-*`
colour appears in the same `cn()` call. This is silent: no error, the class just
vanishes from the DOM and text renders at inherited size.

It's fixed in `src/lib/utils.ts` via `extendTailwindMerge` with an explicit
`font-size` class group. **If you add a new custom `text-*` size name, add it to
the `FONT_SIZES` array there too**, or it will start disappearing.

Verify with rendered HTML, not by eye:
`curl -s localhost:3000/templates | grep -o 'class="[^"]*text-title[^"]*"'`

### 2. Next.js 16 — this is not the Next.js you know

`AGENTS.md` says to read `node_modules/next/dist/docs/` before writing code. The
relevant bits already bitten:

- **`params` and `searchParams` are Promises.** Synchronous access was removed.
  Every dynamic page is `async` and awaits them.
- **Parallel-route slots require an explicit `default.js`** or the build fails.
  Deliberately avoided — the Inbox two-pane is plain flex, not parallel routes.
- Turbopack is the default; `middleware` is renamed to `proxy` (unused here).
- React 19.2 is available: `<Activity>` and View Transitions are legitimate
  options for keeping Inbox panes mounted later.

### 3. Don't read localStorage in an effect

The React Compiler lint rule rejects `setState` inside `useEffect`. The sidebar
preference uses `useSyncExternalStore` with a server snapshot instead
(`app-shell.tsx`) — that's the pattern to copy for any other persisted UI state.

### 4. The type scale is a ceiling, not a suggestion

Kitchen ships **only 10/11/12/13/14px**. `text-base`/`lg`/`xl` were redefined
*downward* so a stray utility can't reintroduce 16px. `text-title` (32px) is the
sole exception, for page titles. If something looks too big, that's the bug.

### 5. Colour is alpha ramps, not a grey scale

`--k-black-04` etc. are translucent so surfaces tint what's behind them. Use the
`-solid` variants (`--k-black-04-solid`) only where layers overlap and opacity
would compound.

---

## Known gaps

**Interpretation, not a port:** the **Board** kanban. No board existed in the
scanned workspace, so the column/card model is inferred from the words "Track
projects". This is flagged in the type definition in `kitchen-data.ts`. If the
real Kitchen board turns out to be a table or timeline, that view needs redoing.

**Chrome without function:**
- Global search (⌘K) opens and dismisses but has no index
- Composer holds text and toggles note-mode but doesn't persist or append
- Message react / reply / more, folder Create and Upload, row `⋯` menus
- Share dialog is real UI but stores nothing (Copy link does work)

**Not built at all:** mobile breakpoints (the `--k-vh`/safe-area tokens are
ported but untested), Document editing, drag-and-drop upload, real search,
folder grid layout toggle, Inbox right-hand reading pane.

---

## Starting the next session

```bash
npm run dev          # localhost:3000
npm run build        # catches async params/searchParams misuse — run before finishing
npm run lint
```

**⚠️ Nothing is committed.** The branch is `main` with a single commit
(`ed4cf33 Initial commit from Create Next App`); every file listed above is
untracked or modified in the working tree. **Commit early in the next session** —
a stray `git checkout` or `git clean` right now destroys the whole build.

Scan reference captures are in `/tmp` (`kc_*.png` = the real Kitchen,
`kr*_*.png` = this build) — these are temporary and may be gone. Re-scan with
browser-harness against `brooksconkle.kitchen.co` if you need them.

### Sensible next moves

1. **Commit the work.** Before anything else.
2. Wire real interaction on the mock layer — composer appends to `MESSAGES`,
   reactions toggle, search filters. Proves the data shapes before a backend.
3. Responsive pass. Every screen is desktop-only today; the narrow-viewport
   check already surfaced a title-wrap bug.
4. Backend, if that's the direction — the accessors at the bottom of
   `kitchen-data.ts` are the seam. Reimplement those and nothing above the data
   layer changes.
5. Re-scan a real Board before trusting the kanban.
