/**
 * Re-establishes the **client** SDK's sign-in from the server session cookie.
 *
 * This app has two independent notions of "signed in":
 *
 *   1. The `__session` cookie, which every server component reads. Fourteen
 *      days, HttpOnly, minted in `/api/auth/session`.
 *   2. The Firebase client SDK's own user, held in IndexedDB. This is what
 *      `storage.rules` sees (`request.auth`), because file bytes go from the
 *      browser straight to the bucket.
 *
 * They come apart more easily than they look: cleared site data, a private
 * window, a tab restored from a session on another device, or a client who
 * accepted an invite in one browser and opened the app in another. The page
 * renders perfectly off the cookie, and then every upload 403s.
 *
 * Rather than telling someone to reload and sign in again — which was the old
 * behaviour, and doesn't even work when the cookie is the only credential
 * that survived — this mints a custom token for whoever holds a valid session
 * cookie so the browser can sign the client SDK back in silently.
 *
 * **No privilege is created here.** The cookie already *is* that person's
 * session; this hands back a one-hour token for the same uid and nothing
 * else. A request without a valid cookie gets a 401.
 *
 * Requires a real service account (`FIREBASE_SERVICE_ACCOUNT_B64`), which
 * signs the token locally. Under bare Application Default Credentials with no
 * key, `createCustomToken` needs the `iam.serviceAccounts.signBlob`
 * permission and fails without it — the error says so explicitly, so it
 * surfaces in the server log rather than as a mystery 500.
 */
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/firebase/session";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const token = await adminAuth().createCustomToken(user.uid);
    return NextResponse.json({ token });
  } catch (cause) {
    console.error("[auth/client-token] createCustomToken failed:", cause);
    return NextResponse.json(
      { error: "Couldn't refresh this browser's session." },
      { status: 500 },
    );
  }
}
