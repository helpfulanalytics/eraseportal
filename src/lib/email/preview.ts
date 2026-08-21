/**
 * Development-only fixtures and a gallery for every template.
 *
 * Email is the one surface with no way to check your work in the app: to see
 * a change you'd have to trigger the real action, against a real recipient, in
 * an environment with real credentials — which is how the old templates got
 * six commits deep without anyone looking at them. `build*` in `templates.ts`
 * is pure, so this renders all of them side by side without a Resend key and
 * without sending a single message.
 *
 * Reachable two ways: `/api/email/preview` while `next dev` is running, and
 * `npm run email:preview`, which writes the same page to a file.
 */
import { renderEmail } from "./layout";
import { STREAM_ACCENT, streamFrom } from "./streams";
import { REPLY_TO } from "./brand";
import {
  buildFileUploadedEmail,
  buildInviteAcceptedEmail,
  buildInviteEmail,
  buildNewMessageEmail,
  buildTaskAssignedEmail,
  buildTaskCompletedEmail,
  type EmailDraft,
} from "./templates";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Deliberately awkward fixtures, not flattering ones: a long file name, a
 * multi-paragraph message, an apostrophe in a client name, a task title that
 * has to be truncated. A gallery of tidy one-liners hides exactly the cases
 * that break a layout.
 */
export const PREVIEWS: Record<string, () => EmailDraft> = {
  "invite-client": () =>
    buildInviteEmail({
      to: "brooks@northgate-kitchens.com",
      personName: "Brooks",
      destinationName: "Northgate Kitchens",
      token: "sample-token-not-real",
      audience: "client",
      invitedByName: "Tosin Alli",
    }),
  "invite-member": () =>
    buildInviteEmail({
      to: "dana@erasefriction.com",
      personName: "Dana",
      destinationName: "Erase Friction",
      token: "sample-token-not-real",
      audience: "member",
      invitedByName: "Tosin Alli",
    }),
  "invite-accepted": () =>
    buildInviteAcceptedEmail({
      to: "tosin@erasefriction.com",
      inviterName: "Tosin",
      inviteeName: "Brooks Conkle",
      inviteeEmail: "brooks@northgate-kitchens.com",
      joinedName: "Northgate Kitchens",
      destinationUrl: `${SITE}/w/northgate-kitchens`,
    }),
  "message-new": () =>
    buildNewMessageEmail({
      to: "tosin@erasefriction.com",
      authorName: "Brooks Conkle",
      conversationId: "conv-sample",
      conversationName: "Cabinet spec sign-off",
      body:
        "The revised elevations look right to me — the only thing I'd change is the run by the window, which still reads a little tight.\n\nHappy to sign off once that's adjusted.",
      attachmentCount: 2,
      folderName: "Phase 2 — Millwork",
      organizationName: "Northgate Kitchens",
      orgSlug: "northgate-kitchens",
      conversationUrl: `${SITE}/w/northgate-kitchens/conversations/conv-sample`,
    }),
  "file-uploaded": () =>
    buildFileUploadedEmail({
      to: "tosin@erasefriction.com",
      uploaderName: "Brooks Conkle",
      fileName: "does not save automatically.jpg",
      bytes: 2_418_332,
      folderId: "folder-sample",
      folderName: "Erase Friction Portal",
      organizationName: "Northgate Kitchens",
      orgSlug: "northgate-kitchens",
      folderUrl: `${SITE}/w/northgate-kitchens/folders/folder-sample`,
    }),
  "task-assigned": () =>
    buildTaskAssignedEmail({
      to: "dana@erasefriction.com",
      assignerName: "Tosin Alli",
      taskId: "task-sample",
      taskTitle: "Send the revised cabinet elevations to Northgate for sign-off",
      dueDate: "2026-08-28",
      folderName: "Phase 2 — Millwork",
      organizationName: "Northgate Kitchens",
      orgSlug: "northgate-kitchens",
      tasksUrl: `${SITE}/w/northgate-kitchens/tasks/me`,
    }),
  "task-completed": () =>
    buildTaskCompletedEmail({
      to: "tosin@erasefriction.com",
      completerName: "Dana Okafor",
      taskId: "task-sample",
      taskTitle: "Send the revised cabinet elevations to Northgate for sign-off",
      folderName: "Phase 2 — Millwork",
      organizationName: "Northgate Kitchens",
      orgSlug: "northgate-kitchens",
      tasksUrl: `${SITE}/w/northgate-kitchens/tasks`,
    }),
};

export type PreviewName = keyof typeof PREVIEWS;

/** The HTML body a recipient would receive, for one template. */
export function previewHtml(name: string): string | null {
  const draft = PREVIEWS[name]?.();
  if (!draft) return null;
  return renderEmail({
    ...draft.content,
    accent: draft.content.accent ?? STREAM_ACCENT[draft.stream],
    siteUrl: SITE,
  }).html;
}

/** The `text/plain` alternative, which is half of why these land in an inbox. */
export function previewText(name: string): string | null {
  const draft = PREVIEWS[name]?.();
  if (!draft) return null;
  return renderEmail({
    ...draft.content,
    accent: draft.content.accent ?? STREAM_ACCENT[draft.stream],
    siteUrl: SITE,
  }).text;
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The gallery. Each email renders inside an `<iframe srcdoc>` so its own
 * `<style>` block and dark-mode media query behave exactly as they will in a
 * webmail client, rather than leaking into the page around it.
 *
 * The header above each frame is the part worth reading: sender, subject and
 * preheader are what a recipient decides on before the body is ever seen, and
 * they're invisible in a rendering that shows the body alone.
 */
export function previewGallery(): string {
  const cards = Object.entries(PREVIEWS)
    .map(([name, build]) => {
      const draft = build();
      const { html, text } = renderEmail({
        ...draft.content,
        accent: draft.content.accent ?? STREAM_ACCENT[draft.stream],
        siteUrl: SITE,
      });

      return `
      <section class="card">
        <div class="meta">
          <div class="name">${escape(name)}</div>
          <dl>
            <dt>From</dt><dd>${escape(streamFrom(draft.stream, draft.actorName))}</dd>
            <dt>Reply-To</dt><dd>${escape(REPLY_TO)}</dd>
            <dt>Subject</dt><dd class="subject">${escape(draft.subject)}</dd>
            <dt>Preview</dt><dd>${escape(draft.content.preheader)}</dd>
            <dt>Stream</dt><dd>${escape(draft.stream)}${draft.threadKey ? ` · threaded on <code>${escape(draft.threadKey)}</code>` : ""}</dd>
          </dl>
        </div>
        <iframe title="${escape(name)}" srcdoc="${escape(html)}" loading="lazy"></iframe>
        <details>
          <summary>text/plain alternative (${text.length} chars)</summary>
          <pre>${escape(text)}</pre>
        </details>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Email templates — Erase Friction Portal</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:32px 20px 80px; background:#f5f5f5; color:#1a1a1a;
         font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:20px; letter-spacing:-0.02em; margin:0 0 4px; }
  .lede { color:#6e6e6e; margin:0 0 32px; max-width:60ch; }
  .grid { display:grid; gap:28px; grid-template-columns:repeat(auto-fill,minmax(600px,1fr)); }
  .card { background:#fff; border:1px solid #e4e4e4; border-radius:14px; overflow:hidden; }
  .meta { padding:16px 18px; border-bottom:1px solid #efefef; }
  .name { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;
          color:#6e6e6e; margin-bottom:10px; }
  dl { display:grid; grid-template-columns:76px 1fr; gap:4px 12px; margin:0; }
  dt { color:#8f8f8f; font-size:12px; }
  dd { margin:0; font-size:13px; word-break:break-word; }
  .subject { font-weight:600; }
  code { font-size:12px; background:#f5f5f5; padding:1px 4px; border-radius:4px; }
  iframe { width:100%; height:720px; border:0; display:block; background:#f5f5f5; }
  details { border-top:1px solid #efefef; }
  summary { padding:10px 18px; cursor:pointer; color:#6e6e6e; font-size:12px; }
  pre { margin:0; padding:0 18px 18px; white-space:pre-wrap; font-size:12px; color:#3a3a3a; }
  @media (prefers-color-scheme: dark) {
    body { background:#0e0e0e; color:#f2f2f2; }
    .card { background:#161616; border-color:#2b2b2b; }
    .meta, details { border-color:#2b2b2b; }
    .lede, dt, summary, .name { color:#a6a6a6; }
    pre { color:#d0d0d0; } code { background:#242424; }
  }
</style>
</head>
<body>
  <h1>Email templates</h1>
  <p class="lede">Every message the portal sends, rendered from the same <code>build*</code> functions
  production uses. Each frame carries its own dark-mode rules — switch your OS theme to check both.</p>
  <div class="grid">${cards}</div>
</body>
</html>`;
}
