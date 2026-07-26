/**
 * Server-side session handling. **Server-only** — pulls in `admin.ts`.
 *
 * The browser signs in with the client SDK, which yields a short-lived ID
 * token. That token is posted to `/api/auth/session`, which exchanges it for a
 * session cookie. Server components then read the cookie, so every route can
 * know who's asking without shipping auth state to the client or waiting on a
 * client-side round trip.
 *
 * The cookie is named `__session` deliberately: Firebase Hosting and Cloud Run
 * strip every other cookie before it reaches the origin, so anything else
 * silently breaks the moment this leaves localhost.
 */
import { cookies } from "next/headers";
import { adminAuth } from "./admin";

export const SESSION_COOKIE = "__session";

/** Firebase caps session cookies at 14 days. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string | undefined;
}

/**
 * The signed-in user, or null. Never throws on a bad cookie — an expired or
 * tampered session should land the visitor on sign-in, not on an error page.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: catches sign-out-everywhere and disabled accounts, at the
    // cost of a lookup per verification.
    const claims = await adminAuth().verifySessionCookie(cookie, true);
    return { uid: claims.uid, email: claims.email };
  } catch {
    return null;
  }
}

/** Exchange a client ID token for a session cookie value. */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}
