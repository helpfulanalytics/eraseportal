/**
 * Transactional email — invites, and message / file / task notifications.
 *
 * Server-only, lazy-init like `adminAuth()`/`adminDb()` in `firebase/admin.ts`,
 * so importing this module never throws just because `RESEND_API_KEY` isn't
 * set in an environment that doesn't need it (tests, a fresh clone before
 * `.env.local` is filled in).
 *
 * `sendEmail` takes *structured content*, not an HTML string. That's the
 * point of the signature: rendering happens in here, so no call site can ship
 * a message that's missing its plain-text alternative, its `Reply-To`, its
 * `List-Id` or its preheader — every one of which is a deliverability
 * liability, and all of which the previous string-of-`<p>`-tags API left to
 * whoever was writing the feature that day.
 *
 * Sender identity comes from `streams.ts`; see `docs/email.md` for the DNS
 * side (SPF, DKIM, DMARC, BIMI) that decides whether any of this arrives.
 */
import { Resend } from "resend";
import { REPLY_TO, SENDING_DOMAIN } from "./brand";
import { renderEmail, type EmailContent } from "./layout";
import {
  STREAM_ACCENT,
  streamFrom,
  streamIsUnsubscribable,
  streamListId,
  streamTag,
  type StreamName,
} from "./streams";

/**
 * Origin for links inside emails. Lives here rather than at each call site
 * because an email is the one place a relative URL is useless — every
 * consumer of this module needs the same absolute base, and two copies would
 * eventually disagree about the fallback.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * A working `List-Unsubscribe` target. Left unset by default and *only* sent
 * when configured, because a header that advertises an unsubscribe the page
 * behind it can't actually perform is worse than no header at all — Gmail
 * counts a dead unsubscribe against the sender. Point it at a real preference
 * page (see `docs/email.md`) and the three activity streams start advertising
 * it automatically.
 */
const UNSUBSCRIBE_URL = process.env.EMAIL_UNSUBSCRIBE_URL;

let client: Resend | null = null;

function getResend(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
    client = new Resend(apiKey);
  }
  return client;
}

export interface SendInput {
  to: string;
  subject: string;
  stream: StreamName;
  /** Everything below the `<html>` — see `layout.ts`. `accent` is filled in from the stream. */
  content: Omit<EmailContent, "accent" | "siteUrl"> & { accent?: EmailContent["accent"] };
  /**
   * The person whose action triggered this, if any. Fronts the `From` display
   * name — "Brooks Conkle via Erase Friction" — which is what makes a busy
   * inbox scannable.
   */
  actorName?: string;
  /**
   * Stable key for a series of related notifications (a conversation id, a
   * task id). Threads them together in Gmail instead of leaving one loose
   * message per event. Omit and each send gets a unique reference instead, so
   * unrelated notifications *aren't* collapsed into one another.
   */
  threadKey?: string;
  /** Resend `type` tag, for per-template stats. ASCII letters, digits, `_` and `-` only. */
  type: string;
}

/**
 * Every call site wraps this in try/catch and treats a failure as
 * non-fatal — a mutation (send a message, complete a task) must succeed
 * even when email delivery doesn't.
 */
export async function sendEmail(input: SendInput): Promise<void> {
  const content: EmailContent = {
    ...input.content,
    accent: input.content.accent ?? STREAM_ACCENT[input.stream],
    siteUrl: SITE_URL,
  };
  const { html, text } = renderEmail(content);

  const headers: Record<string, string> = {
    "List-Id": streamListId(input.stream),
    // RFC 3834 / Exchange: stop out-of-office autoresponders from replying to
    // a no-reply stream and, worse, looping.
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "OOF, AutoReply",
  };

  if (input.threadKey) {
    const ref = `<${input.stream}-${input.threadKey}@${SENDING_DOMAIN}>`;
    headers["References"] = ref;
    headers["In-Reply-To"] = ref;
  } else {
    // Gmail collapses messages it thinks are the same conversation, which
    // silently hides notifications with repeating subjects. A unique
    // reference per send keeps them distinct.
    headers["X-Entity-Ref-ID"] = crypto.randomUUID();
  }

  if (UNSUBSCRIBE_URL && streamIsUnsubscribable(input.stream)) {
    headers["List-Unsubscribe"] = `<${UNSUBSCRIBE_URL}>`;
  }

  await getResend().emails.send({
    from: streamFrom(input.stream, input.actorName),
    to: input.to,
    replyTo: REPLY_TO,
    subject: input.subject,
    html,
    text,
    headers,
    tags: [
      { name: "stream", value: streamTag(input.stream) },
      { name: "type", value: input.type },
    ],
  });
}
