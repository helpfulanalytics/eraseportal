"use client";

/**
 * Browser → bucket uploads.
 *
 * Bytes deliberately don't pass through a Next.js route handler: server
 * actions cap request bodies at a couple of megabytes by default, and
 * streaming a 20 MB attachment through the server costs bandwidth twice for no
 * benefit. The browser writes to Storage directly, then tells the server where
 * it landed.
 *
 * That makes storage.rules the real access control for this path — see the
 * size and content-type checks there.
 */
import { signInWithCustomToken } from "firebase/auth";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { firebaseAuth, firebaseStorage } from "./client";

export interface UploadResult {
  path: string;
  downloadUrl: string;
  bytes: number;
  mime: string;
}

/**
 * Storage object paths must survive two files with the same name, so the
 * object key is randomised and the display name is carried in Firestore
 * instead. `crypto.randomUUID` is available in every browser that runs this.
 */
function objectPath(prefix: string, file: File): string {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()}`
    : "";
  return `${prefix}/${crypto.randomUUID()}${extension}`;
}

export class NotSignedInError extends Error {
  constructor() {
    super("Your session expired in this tab. Reload the page and sign in again.");
    this.name = "NotSignedInError";
  }
}

/**
 * Guarantees the client SDK has a signed-in user before an upload starts.
 *
 * `storage.rules` requires `request.auth != null` on every path this app
 * writes to, and the client SDK's user is a *different* thing from the server
 * session cookie the pages render off. Two ways they disagree, both of which
 * used to surface as "your session expired — reload and sign in again":
 *
 *   1. **The common one, and a real bug.** `currentUser` is `null` for the
 *      first moments of every page load: the SDK restores the session from
 *      IndexedDB asynchronously, and reading `currentUser` synchronously
 *      races that. Anyone who uploaded soon after a reload was told their
 *      session had expired when it hadn't. `authStateReady()` is the fix —
 *      it resolves once the initial state is known, signed in or not.
 *   2. **The genuine one.** The cookie is valid but the browser really has no
 *      client session — cleared site data, a private window, a session
 *      started on another device. Telling someone to "sign in again" doesn't
 *      even help there, because the cookie is already the credential that
 *      survived. `/api/auth/client-token` mints a custom token from it and
 *      signs the SDK back in without anyone noticing.
 *
 * Only when both fail is this actually a signed-out browser.
 */
async function ensureClientAuth(): Promise<void> {
  const auth = firebaseAuth();

  await auth.authStateReady();
  if (auth.currentUser) return;

  try {
    const response = await fetch("/api/auth/client-token", { method: "POST" });
    if (!response.ok) throw new Error(String(response.status));

    const { token } = (await response.json()) as { token?: string };
    if (!token) throw new Error("No token.");

    await signInWithCustomToken(auth, token);
  } catch {
    throw new NotSignedInError();
  }
}

/**
 * Uploads one file and resolves once it's in the bucket.
 *
 * Returns a promise rather than the `UploadTask`: nothing has ever needed to
 * pause or cancel an upload, and the task can't exist until the auth check
 * above has awaited, which a synchronous return can't do.
 */
export async function uploadFile(
  prefix: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  await ensureClientAuth();

  const path = objectPath(prefix, file);
  const task = uploadBytesResumable(ref(firebaseStorage(), path), file, {
    contentType: file.type || "application/octet-stream",
    // Keeps the original name available on the object itself, so the bucket
    // stays legible to a human browsing it without Firestore alongside.
    customMetadata: { originalName: file.name },
  });

  return new Promise<UploadResult>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
        }
      },
      reject,
      async () => {
        resolve({
          path,
          downloadUrl: await getDownloadURL(task.snapshot.ref),
          bytes: task.snapshot.totalBytes,
          mime: task.snapshot.metadata.contentType ?? "application/octet-stream",
        });
      },
    );
  });
}
