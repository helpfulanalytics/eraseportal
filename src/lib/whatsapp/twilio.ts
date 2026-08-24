/**
 * WhatsApp transport, via Twilio.
 *
 * Optional, like `giphy.ts`: nothing here is read at import time, so a clone
 * with no Twilio credentials still builds and runs. `isWhatsAppConfigured()`
 * lets every call site skip the channel cleanly instead of failing at the
 * network — the same role `fcmTokens` absence already plays for push.
 */
import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN is not set.");
    }
    client = twilio(sid, token);
  }
  return client;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
  );
}

/**
 * Sends a plain-text WhatsApp message. `to` is E.164 (`+14155551234`), same
 * shape as `Person.phone` — the `whatsapp:` prefix is added here so callers
 * never have to remember it.
 */
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("TWILIO_WHATSAPP_FROM is not set.");

  await getClient().messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${to}`,
    body,
  });
}
