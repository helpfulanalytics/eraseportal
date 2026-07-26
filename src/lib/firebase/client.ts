/**
 * Browser-side Firebase. Used for exactly two things:
 *
 *   1. Auth — the sign-in/sign-up forms need the client SDK to run the
 *      credential flow, then hand the resulting ID token to the server so it
 *      can mint a session cookie (see `src/lib/firebase/session.ts`).
 *   2. Storage uploads — file bytes go browser → bucket directly, so they
 *      never pass through a Next.js route handler and hit its body-size cap.
 *
 * Everything else reads through the Admin SDK on the server. If you're
 * reaching for `getFirestore` from here, check whether the data can be fetched
 * in a server component and passed down as props instead — that's the pattern
 * the rest of the app uses.
 */
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Next dev remounts modules across HMR reloads; `initializeApp` throws on the
 * second call, so reuse whatever is already registered.
 */
export const firebaseApp = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);

/**
 * True once `.env.local` is filled in. The UI uses this to show an explicit
 * "not configured" state rather than failing inside the SDK with an opaque
 * `auth/invalid-api-key`.
 */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);
