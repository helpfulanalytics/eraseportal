/**
 * Post-sign-in destination handling. Client- and server-safe: no I/O.
 */

/** Where sign-in lands when there's nothing better. */
export const DEFAULT_LANDING = "/";

/**
 * Sanitise a `?next=` value before redirecting to it.
 *
 * Whatever arrives here came from a query string, so it's attacker-controlled:
 * a link to `/sign-in?next=https://evil.example` would otherwise turn our own
 * sign-in page into a credible redirect to someone else's. Only same-origin,
 * absolute-path destinations are allowed through.
 *
 * `//evil.example` is the case worth calling out — it starts with `/`, so a
 * naive check passes it, but browsers read it as a protocol-relative URL and
 * leave the site.
 */
export function safeNext(
  next: string | undefined | null,
  fallback: string = DEFAULT_LANDING,
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  // `/\evil.example` is normalised to a protocol-relative URL by some browsers.
  if (next.startsWith("/\\")) return fallback;
  // Never send someone back to an auth route after authenticating.
  if (/^\/(sign-in|sign-up|reset-password)(\/|\?|$)/.test(next)) return fallback;
  return next;
}
