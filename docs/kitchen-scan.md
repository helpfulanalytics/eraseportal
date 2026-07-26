# Kitchen.co — design & functionality scan

Scanned live from `brooksconkle.kitchen.co` (Kea Marketing LLC workspace) on 2026-07-25.
Source of truth for building the replacement in this repo.

---

## 1. Object model

Kitchen is a **client-facing workspace**, not a task tracker. Everything nests under a workspace.

```
Workspace  ("Kea Marketing LLC")
└── Folder            /folders/fo_<id>          ← the unit of client work
    ├── Conversation  /conversations/convr_<id> ← threaded chat, has Messages + Files tabs
    ├── Board                                    ← "Track projects" (not present in this workspace)
    ├── Document                                 ← "Curate content"
    ├── Embed                                    ← "Add third-party apps" (iframe)
    └── File           (uploaded, PDF/img/etc — first-class row, not an attachment)

Client   /clients      ← person record; separate Companies tab
Task     /tasks        ← cross-workspace, table + calendar views
Template               ← "Create folders in a snap" (folder blueprints)
```

Key structural facts:
- Folders are the primary container and appear in the left sidebar tree with their children nested under them.
- A folder has a **cover image**, a **title + emoji/icon**, and a **subtitle URL** (`https://www.cardflowfinancial.com/`).
- Items inside a folder are a flat table: `Name | Created | ⋯` with type icon + metadata line (`70 messages`, `PDF • 40.7 kB`).
- IDs are prefixed opaque strings: `fo_`, `convr_`, `msg_`. Deep links to a message use `#msg_<id>` and the target message renders with a **blue focus outline**.

## 2. Navigation & layout

Three columns, fixed:

| Region | Width | Contents |
|---|---|---|
| **Icon rail** (far left) | ~64px | Logo, Home, Inbox, Clients, Tasks, More, then bottom-pinned: panel-collapse toggle, Settings. Icon + 11px label stacked, active = grey rounded-square pill behind icon. |
| **Sidebar** | ~295px | Workspace name + `+` create + chevron. Flat links (Home / My Tasks / Library), then a `Folders` section header with the folder tree. Active row = light grey fill, radius 6. Collapsible. |
| **Main** | fill | White card floating on `#f5f5f5` page background, rounded ~10px, inset ~12px from edges. |

- **Global search** is a pill input centred in the top bar, above everything (`Search Kea Marketing LLC…`), plus a full-screen overlay palette (600px wide, 44px input at 18px font, backdrop `black-24`).
- Avatar sits top-right, outside the card.
- `More` opens a small popover panel (title + gear + close) rather than a menu — currently only `Templates`.

## 3. Screens observed

### Home (`/`)
`👋 Welcome, {name}!` in ~32px semibold. Then **Recent Folders** — cover-art tiles (`~190px` square, grey placeholder + big folder glyph) with name + `5 items`. Then **Create** — a row of 6 outlined cards, each icon + bold label + grey one-line description: New Folder / Board / Conversation / Embed / Document / Client.

### Inbox
Two-pane. Left list (~570px) with tabs **Chats · Tasks · Files · Updates**, header actions (archive, mark-read, filter, ⋯). Each row: avatar, bold sender, right-aligned date, then either an *italic* system line (`Mentioned you in conversation "…"`) or a 2-line message preview, then a grey breadcrumb (`CardFlowFinancial / CardFlow - Chelsea / Brooks / Tosin`). Right pane keeps rendering Home. No unread dot observed — read state is implicit.

### Conversation
- Header: 💬 icon + title + favourite star; right side filter, ⋯, participant avatar stack, black **Share** button. Tabs: **Messages · Files**.
- Messages are a flat vertical list, **not bubbles per side**. Author avatar + bold name + date, message body in a full-width rounded panel.
  - Own messages: light blue-grey fill.
  - Others': light grey fill.
  - Deep-linked / focused message: white with blue border.
- Hover reveals a floating action group top-right of the message: emoji react, reply, ⋯.
- Reactions render as a small count chip under the message.
- `@mentions` render as blue pill tokens. A message can be *only* a mention.
- Rich text supported (bold, bullets, autolinked URLs); files attach inline as a card (`SANDBOX_HANDOFF.pdf / PDF • 218.93 kB`).
- Composer is docked at the bottom, full width, bordered rounded box: placeholder `Write a message or note, or just drag files here…`, blue **Send**, then attach, image, GIF, ⋯, mic, and a note/doc toggle. The "or note" wording implies an internal-note mode alongside client-visible messages.

### Clients (`/clients`)
Big tab-style page title: **Clients** / **Companies** (inactive one is grey, both 32px). Search input scoped with a count (`Search 1 client…`), a `Created` sort dropdown, blue **+ Create Client** on the right. Table: `Name | Email | Created` with an avatar per row, sort arrow on the active column, column-picker icon at the far right, `1–1 of 1` footer.

### Tasks (`/tasks?view=all_tasks&layout=table&order=due_date`)
Same big-tab pattern: **All Tasks** / **Completed**. Sub-tabs **Table · Calendar**. Right-aligned blue icon actions: filter, sort, layout, ⋯. Empty state is a centred `No results found.` between two hairlines. **View state lives in the URL** (`view`, `layout`, `order`) — worth copying.

### Folder (`/folders/fo_…`)
Full-bleed cover image at top. Then folder icon + name (32px) + star + cover-edit + description-toggle icons, the URL subtitle, then a control row: `Search this folder…`, `Author ▾`, `Created ▾`, grey `+ Create ▾`, blue `↑ Upload or Drag ▾`. Item table `Name | Created` with grid/list toggle and per-row `⋯`.

## 4. Design tokens (lifted from the live app)

The app ships **133 CSS custom properties** under a `--k-*` namespace. The system is deliberately near-monochrome — colour is used only for state.

**Type**
- Family: `Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, …` — falls back to system stack.
- Sizes: only `10 / 11 / 12 / 13 / 14px`. Body **14px/400**, buttons **13px/400**, section titles 20px/500. Page titles ~32px.
- Line heights: only `16px` and `20px`.
- Body text `#333`; primary heading colour is `black-84` (`#000000d6`), not pure black.

**Colour** — the palette is *alpha ramps over black/white*, not a grey scale:
```
black:  02 03 04 05 06 07 08 09 10 12 16 18 20 22 23 24 25 28 30 32 36 38 40 50 56 64 72 80 84
white:  06 08 10 12 16 24 32 40 48 50 72 84
```
plus solid mirrors for the ones that need opacity-free rendering (`black-03-solid #f7f7f7`, `04-solid #f5f5f5`, `06-solid #f0f0f0`, `08-solid #ebebeb`).

Named greys: `#e0e0de`, `#f3f3f1`, `#f5f5f5`, `#e4e4e4`, `#adadad`, `#8f8f8f`, `#f7f7f7`, `#f8f6f4`, `#b2b2b2`, `#f4f4f4`, `#e2e2e2`.

Accents (each with its own alpha ramp):
| Role | Hex |
|---|---|
| Blue (primary action, links, active icons) | `#0165e1` |
| Red (destructive) | `#ee543b` (deep `#d34a34`) |
| Yellow (folders, warnings) | `#fec30c` |
| Green (success) | `#41c660` (deep `#10b120`, `#0e9c1b`) |
| Purple | `#b25dd4` |

**Radius** — a full ladder, not a t-shirt scale: `1 2 3 4 5 6 7 8 10 12 14 16 20px` + `999px`. Buttons use **6px**, sidebar rows 6px, cards ~10–12px.

**Elevation** — hairline + soft shadow, never a hard border:
`0 0 0 .5px var(--k-color-black-16), 0 6px 32px 0 var(--k-color-black-32)`

**Mobile plumbing** worth stealing: `--k-vh: calc(100dvh - var(--k-keyboard-height))`, `--k-safe-area-inset-bottom`.

**Theming hook**: components read `var(--kitchen-font-family, …)` and `var(--kitchen-border-radius, …)` — i.e. white-labelling is a documented seam. Component-scoped vars exist too (`--components-icon-button-hover-background: var(--k-color-black-04)`).

## 5. Feature inventory

| Area | Feature |
|---|---|
| Workspace | Named workspace, workspace switcher, global search + ⌘K palette, per-workspace branding hooks |
| Folders | Nest items, cover image, URL/description, star/favourite, templates, grid & list view, in-folder search, filter by author/date, drag-and-drop upload |
| Conversations | Threaded messages, rich text, @mentions, reactions, reply, per-message deep links, message vs internal note, file attachments, Files tab, participant avatars, filter, share |
| Files | First-class items, type + size metadata, thumbnail previews, upload by drag |
| Inbox | Unified across Chats / Tasks / Files / Updates, mention notifications, breadcrumb source, archive & mark-read, filter |
| Clients | Client + Company records, email, created date, invite flow, search, sortable/configurable table columns, pagination |
| Tasks | All/Completed, table + calendar layouts, due-date ordering, filter/sort/layout controls, URL-persisted view state, My Tasks scope |
| Sharing | Share button on folders and conversations — client-facing external access is the core value prop |
| Other | Boards (project tracking), Documents, Embeds, Library, Templates, Settings |

## 6. Gap vs. what's in this repo today

`src/app/app/` currently scaffolds a **different product** — an agency tracker with projects, teams (`design`/`engineering`/`growth`), milestones, invoices, and hours (`src/lib/agency-data.ts`). Its shell is a Linear-style top bar + team channels.

To become a Kitchen replacement:
- **Replace the domain model.** `Project/Milestone/Invoice/TeamMember` → `Workspace/Folder/Item(Conversation|Board|Doc|Embed|File)/Message/Client/Task`.
- **Rebuild the shell.** Kitchen is icon-rail + tree sidebar + floating white card on grey; the current `app-shell.tsx` is a header bar + channel list. The rail/sidebar/card geometry is the single most recognisable thing about Kitchen.
- **Re-token `globals.css`.** It's stock shadcn oklch neutrals. Kitchen's identity comes from the black/white alpha ramps, the 13/14px type floor, 6px button radius, and `#0165e1`.
- **Keep** the shadcn/base-ui component layer, `cn()`, and the auth flows (`sign-in`, `sign-up`, `onboarding`, `reset-password`) — those are orthogonal and reusable.

Screenshots from the scan: `/tmp/kc_home.png`, `kc_inbox.png`, `kc_clients.png`, `kc_tasks.png`, `kc_more.png`, `kc_folder.png`, `/tmp/shot.png` (conversation).

## 7. Not observed
- **Board** view — no board exists in this workspace; the "Track projects" description is all we have.
- Document editor, Embed config, Library, Settings, Templates gallery, Companies tab, Calendar layout, the Share dialog, and any mobile breakpoint.
