/**
 * Exchanges a Firebase ID token for a session cookie, and clears it on sign
 * out.
 *
 * The browser holds the ID token for about an hour and can't set an
 * HttpOnly cookie itself, so it posts the token here once and the server sets
 * a cookie the client script can never read. Server components then get the
 * session for free on every request.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/firebase/session";

export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  try {
    const value = await createSessionCookie(idToken);
    const store = await cookies();

    store.set(SESSION_COOKIE, value, {
      httpOnly: true,
      // Off on localhost, since dev serves over plain HTTP.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // A rejected token is the expected failure here — expired, malformed, or
    // minted for another project. Nothing worth distinguishing for the caller.
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
