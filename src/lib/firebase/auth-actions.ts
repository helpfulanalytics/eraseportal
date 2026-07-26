"use client";

/**
 * Browser-side auth flows.
 *
 * Each one is two steps: run the credential flow with the client SDK, then
 * post the resulting ID token to `/api/auth/session` so the server can set a
 * session cookie. Skipping the second step leaves you signed in as far as the
 * browser is concerned and signed out as far as every server component is
 * concerned — which renders as an immediate redirect back to sign-in.
 */
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import { firebaseAuth } from "./client";

/**
 * Maps Firebase's error codes to something worth showing a person.
 *
 * `invalid-credential` deliberately covers wrong-password, no-such-user and
 * disabled-account alike: distinguishing them tells an attacker which emails
 * are registered.
 */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Passwords need to be at least six characters.";
    case "auth/invalid-email":
      return "That doesn't look like an email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "Couldn't reach the server. Check your connection.";
    default:
      return "Something went wrong signing you in. Try again.";
  }
}

/** Trade the credential's ID token for an HttpOnly session cookie. */
async function establishSession(credential: UserCredential): Promise<void> {
  const idToken = await credential.user.getIdToken();

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    // Don't leave the browser holding a signed-in SDK state the server won't
    // honour — that produces a redirect loop rather than an error message.
    await firebaseSignOut(firebaseAuth());
    throw new Error("Could not start a session.");
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  await establishSession(credential);
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth(),
    email,
    password,
  );
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await establishSession(credential);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(firebaseAuth());
  await fetch("/api/auth/session", { method: "DELETE" });
}
