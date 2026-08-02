import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/session";

/**
 * Two jobs, both cheap enough to run on every request.
 *
 * 1. Bounce signed-out visitors off workspace routes, remembering where they
 *    were headed so sign-in can return them there.
 * 2. Publish the request path as a header, because server components can't
 *    otherwise see it — the workspace layout needs it to build the same
 *    `?next=` link when *its* verification fails.
 *
 * This only checks that a session cookie **exists**. It never verifies it:
 * Proxy runs on prefetches too, and per the Next docs it's for optimistic
 * checks, not session management. Real verification happens in the workspace
 * layout, which has the Admin SDK.
 *
 * That split also avoids a redirect loop. A cookie that is present but invalid
 * gets past this file, is rejected by the layout, and lands on `/sign-in` —
 * which this file deliberately leaves alone. Redirecting away from `/sign-in`
 * whenever a cookie exists would bounce such a request back and forth forever.
 * The signed-in-user-visits-sign-in case is handled on the auth pages instead,
 * where the session can actually be verified.
 */

/** Path header consumed by `(workspace)/layout.tsx`. */
export const PATHNAME_HEADER = "x-pathname";

/** Routes that render without a session. Everything else needs one. */
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/reset-password",
  "/onboarding",
  "/invite",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const userAgent = request.headers.get("user-agent") || "";
  const isBot = /bot|whatsapp|facebookexternalhit|slack|twitter|linkedin/i.test(userAgent);
  if (isBot) {
    const match = pathname.match(/^\/w\/[^\/]+\/(folders|embeds|documents|conversations|boards)\/([^\/]+)$/);
    if (match) {
      const type = match[1];
      const id = match[2];
      return NextResponse.rewrite(new URL(`/bot/${type}/${id}`, request.url));
    }
  }

  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, `${pathname}${search}`);

  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    // Only worth carrying a destination that isn't the default landing page.
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  /**
   * Skip API routes, Next internals and anything with a file extension.
   * `/api/auth/session` in particular must stay reachable while signed out —
   * it's the endpoint that establishes the session in the first place.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
