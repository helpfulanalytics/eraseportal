/**
 * Server-side Firebase. This module holds credentials that bypass every
 * security rule, so it must never reach the browser.
 *
 * Next.js won't always catch that for you: importing this from a file that
 * later grows a `"use client"` sibling is an easy mistake, and the failure
 * mode is a leaked service account rather than a build error. The guard below
 * turns that into a loud crash instead.
 */
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/firebase/admin.ts was imported in the browser. It holds service " +
      "account credentials — move the caller to a server component, a route " +
      "handler, or a server action.",
  );
}

const ADMIN_APP_NAME = "kitchen-admin";

/**
 * Credentials come from one of two places, in order:
 *
 *   1. FIREBASE_SERVICE_ACCOUNT_B64 — a base64'd service account JSON. Base64
 *      because the raw JSON's newlines inside `private_key` don't survive most
 *      env-var plumbing intact.
 *   2. Application Default Credentials — what App Hosting, Cloud Run, and a
 *      local `gcloud auth application-default login` all provide.
 */
function credential() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!encoded) return applicationDefault();

  try {
    const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    return cert(json);
  } catch (cause) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is set but isn't valid base64-encoded " +
        "JSON. Re-generate it with: base64 -i service-account.json",
      { cause },
    );
  }
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existing) return existing;

  return initializeApp(
    {
      credential: credential(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    ADMIN_APP_NAME,
  );
}

/**
 * Lazy accessors rather than module-level constants: importing this file
 * shouldn't blow up at build time on a machine that has no credentials, only
 * when something actually tries to read.
 */
export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
export const adminBucket = () => getStorage(adminApp()).bucket();

/** Mirrors `isFirebaseConfigured` on the client, for server-side branching. */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      (process.env.FIREBASE_SERVICE_ACCOUNT_B64 ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS),
  );
}

export { getApp };
