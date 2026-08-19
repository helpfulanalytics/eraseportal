/**
 * Transactional email — client invites, message/mention and task
 * notifications. Server-only, lazy-init like `adminAuth()`/`adminDb()` in
 * `firebase/admin.ts`, so importing this module never throws just because
 * `RESEND_API_KEY` isn't set in an environment that doesn't need it (tests,
 * a fresh clone before `.env.local` is filled in).
 *
 * No verified sending domain has been confirmed for this project yet, so
 * `FROM_ADDRESS` defaults to Resend's shared sandbox sender. Sandbox sending
 * only reaches the account's own verified test addresses — swap this for a
 * real `noreply@yourdomain.com` once a domain is verified in the Resend
 * dashboard.
 */
import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Erase Friction Portal <onboarding@resend.dev>";

/**
 * Origin for links inside emails. Lives here rather than at each call site
 * because an email is the one place a relative URL is useless — every
 * consumer of this module needs the same absolute base, and two copies would
 * eventually disagree about the fallback.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

let client: Resend | null = null;

function getResend(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
    client = new Resend(apiKey);
  }
  return client;
}

/**
 * Every call site wraps this in try/catch and treats a failure as
 * non-fatal — a mutation (send a message, complete a task) must succeed
 * even when email delivery doesn't.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
