# Notification system improvements

**Status: built and verified live** — all five items under "Building now"
are done. See the bottom of this file for what's still open.

Scoped from the brainstorm: in-app badges, mentions-as-special, push. A
notification center (bell + feed) is deliberately **out of scope** here — it's
a standalone feature (new UI surface + an activity-feed data layer), not an
extension of what exists. Listed at the bottom as a follow-up.

## What already exists (verified in code, not assumed)

- **Unread badges**: red count on dashboard project cards, sidebar board/chat
  rows, folder-list rows. Computed from cards/comments/messages created by
  someone else since `lastReadAt`; cleared instantly on open
  (`clearUnread` in `workspace-provider.tsx`).
- **Push notifications already fire** for: new messages, task assignment,
  card added, file uploads (`adminMessaging().sendEachForMulticast` — 6 call
  sites in `actions.ts` / `folders/[folderId]/actions.ts`). Click-through
  deep-links via `data: { url }` in `public/firebase-messaging-sw.js`,
  already working. Registration is opt-in only, via "Enable Notifications" in
  the avatar menu (`user-menu.tsx`) — easy to miss.
- **Mentions already parse and render**: `Inline { t: "mention", personId }`
  in `kitchen-types.ts`, produced by `parseInline` in `kitchen-data.ts`,
  rendered as a blue pill by `InlineRun`. Every conversation message already
  emails + pushes every participant regardless of whether they were
  mentioned — mentions get no *extra* weight today, and non-mentions get no
  less. **Board card comments are plain strings (`BoardCardComment.text`)
  with no mention support at all** — out of reach for "mentions are special"
  until comments carry `Block[]` too. Not doing that rewrite here.

## Building now

1. **Tab title badge** — `<title>` shows `(N) Erase Friction Portal` for the
   total unread count across the open org, updating client-side as badges
   clear. Cheap, high visibility (catches a stale background tab).
2. **Folder-row badge** — a folder's own sidebar row shows the sum of its
   children's unread counts, so a *collapsed* folder still signals activity
   inside it (today the count only shows once you expand it).
3. **Rail Home dot** — a small dot on the left rail's Home icon when there's
   unread anything in the current org, visible even when the sidebar itself
   is scrolled past.
4. **Mention-aware badges** — a conversation whose unread messages include a
   mention of the viewer gets a visually distinct badge (outline ring) instead
   of the plain red dot, so a mention doesn't read the same as five people
   chatting about something else. Board badges are unaffected (no mention
   support there, per above).
5. **Earlier push permission prompt** — a one-time, dismissible banner
   shortly after first sign-in asking to enable notifications, instead of
   requiring someone to find it in the avatar menu. Remembers dismissal in
   `localStorage` so it doesn't nag.

## Explicitly not changing

- **Notification volume/throttling.** Every message to every participant
  still emails + pushes, mentioned or not. Narrowing that (e.g. push only on
  mentions once a channel gets busy) is a real behavior change for every
  existing user and deserves its own conversation, not a silent side effect
  of a badge-styling task.
- **Board comment mentions.** Would need `BoardCardComment.text: string` →
  `body: Block[]`, migrating existing comments, and updating every renderer
  that reads `.text`. Bigger than this pass.

## Follow-up (not building today)

- **Notification center**: bell icon near search/avatar, dropdown or page
  listing recent activity across projects (reuses `getRecentMessages`'s
  aggregation shape, extended to board activity), mark-all-as-read, mentions
  filterable/highlighted. Its own session.
