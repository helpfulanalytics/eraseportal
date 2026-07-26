/**
 * Browser-side Firebase. Used for exactly two things:
 *
 *   1. Auth — the sign-in/sign-up forms need the client SDK to run the
 *      credential flow, then hand the resulting ID token to the server so it
 *      can mint a session cookie (see `session.ts`).
 *   2. Storage uploads — file bytes go browser → bucket directly, so they
 *      never pass through a Next.js route handler and hit its body-size cap.
 *
 * Everything else reads through the Admin SDK on the server. If you're
 * reaching for `getFirestore` from here, check whether the data can be fetched
 * in a server component and passed down as props instead — that's the pattern
 * the rest of the app uses.
 *
 * Initialisation is lazy, and that matters: the `(auth)` pages are statically
 * prerendered, so anything evaluated at module scope runs at build time, on
 * the server, where the browser config may not exist. Eagerly calling
 * `getAuth()` here fails the build with `auth/invalid-api-key`. Nothing below
 * touches Firebase until a handler actually calls it.
 */
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True once `.env.local` is filled in. Lets callers show an explicit "not
 * configured" state instead of failing inside the SDK with an opaque
 * `auth/invalid-api-key`.
 */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

function firebaseApp() {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase isn't configured. Copy .env.local.example to .env.local and " +
        "fill it in — see docs/firebase-setup.md.",
    );
  }
  // Next dev remounts modules across HMR reloads; initializeApp throws on the
  // second call, so reuse whatever is already registered.
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firebaseStorage(): FirebaseStorage {
  return getStorage(firebaseApp());
}
