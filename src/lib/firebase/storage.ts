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
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";
import { firebaseStorage } from "./client";

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

export function uploadFile(
  prefix: string,
  file: File,
  onProgress?: (fraction: number) => void,
): { task: UploadTask; done: Promise<UploadResult> } {
  const path = objectPath(prefix, file);
  const task = uploadBytesResumable(ref(firebaseStorage(), path), file, {
    contentType: file.type || "application/octet-stream",
    // Keeps the original name available on the object itself, so the bucket
    // stays legible to a human browsing it without Firestore alongside.
    customMetadata: { originalName: file.name },
  });

  const done = new Promise<UploadResult>((resolve, reject) => {
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

  return { task, done };
}
