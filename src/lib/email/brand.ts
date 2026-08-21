/**
 * Visual and identity constants for outgoing mail.
 *
 * Separate from `globals.css` on purpose: email can't read CSS custom
 * properties, so every value here is a literal hex the template inlines. The
 * numbers are the same ones the product uses — see `docs/kitchen-scan.md` §4 —
 * transcribed rather than imported, because an email that silently changed
 * colour when a token moved would be a bug nobody would notice for months.
 */

/** What the recipient sees as the product's name, everywhere. */
export const PRODUCT_NAME = "Erase Friction Portal";

/** Short form, for footers and sender display names where the full name runs long. */
export const PRODUCT_SHORT = "Erase Friction";

/**
 * The authenticated sending domain. Every stream in `streams.ts` is a
 * local-part on *this* domain and nothing else — see `docs/email.md` on why
 * splitting across domains is what actually gets mail filtered.
 */
export const SENDING_DOMAIN =
  process.env.EMAIL_SENDING_DOMAIN || "erasefriction.com";

/**
 * A monitored human inbox. Set as `Reply-To` on every send: a notification
 * that bounces when replied to is one of the cheaper ways to look automated,
 * and mailbox providers treat replies as a strong positive engagement signal.
 */
export const REPLY_TO = process.env.EMAIL_REPLY_TO || `hello@${SENDING_DOMAIN}`;

/**
 * Absolute URL of the header logo.
 *
 * Defaults to the app's own PNG route (`/api/email/logo`) because Gmail
 * strips inline `<svg>` and won't render an `.svg` `<img>` either, so the
 * mark in `icon.svg` has to be rasterised somewhere. Override with a real
 * logo file — `EMAIL_LOGO_URL=https://…/logo.png` — once one exists.
 */
export function logoUrl(siteUrl: string): string {
  return process.env.EMAIL_LOGO_URL || `${siteUrl}/api/email/logo`;
}

/** Postal address, required by CAN-SPAM/CASL on anything non-transactional. */
export const POSTAL_ADDRESS = process.env.EMAIL_POSTAL_ADDRESS || "";

/**
 * Palette. Deliberately narrow — one accent per email, everything else
 * greyscale. Email clients that auto-invert for dark mode do far less damage
 * to a near-monochrome design than to a coloured one.
 */
export const COLOR = {
  pageBg: "#f5f5f5",
  cardBg: "#ffffff",
  insetBg: "#f7f7f7",
  hairline: "#e4e4e4",
  hairlineSoft: "#efefef",
  text: "#1a1a1a",
  textMuted: "#6e6e6e",
  textFaint: "#8f8f8f",
  blue: "#0165e1",
  green: "#0e9c1b",
  red: "#d34a34",
  amber: "#b07d00",
  purple: "#8a3fb0",
} as const;

export type AccentName = "blue" | "green" | "red" | "amber" | "purple";

/**
 * Single quotes around the multi-word families, not double.
 *
 * This stack is interpolated into `style="…"` attributes, so a double quote in
 * it closes the attribute early and silently discards every declaration after
 * it — which cost the headline its font and the CTA its white text before
 * anyone rendered one. CSS treats `'Segoe UI'` and `"Segoe UI"` identically;
 * HTML does not.
 */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
