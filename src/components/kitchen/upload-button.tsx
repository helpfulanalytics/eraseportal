"use client";

/**
 * The folder header's Upload control.
 *
 * Two steps per file: bytes to Storage from the browser, then a server action
 * to record the result in Firestore. Uploads run sequentially rather than in
 * parallel — a folder upload is usually a handful of files, and a serial queue
 * keeps the progress label honest and the failure case obvious.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, UploadIcon } from "lucide-react";
import { registerUpload } from "@/app/w/[orgSlug]/folders/[folderId]/actions";
import { uploadFile } from "@/lib/firebase/storage";
import { blockedUploadReason } from "@/lib/kitchen-format";

/**
 * The upload flow itself, shared by the button (file picker) and the
 * folder's drag-and-drop zone — same sequential-with-progress behaviour,
 * same notification side effects via `registerUpload`, regardless of which
 * one a file came in through.
 */
export function useFolderUpload(folderId: string) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    setError(null);

    for (const [index, file] of list.entries()) {
      const position = list.length > 1 ? ` (${index + 1}/${list.length})` : "";

      const reason = blockedUploadReason(file);
      if (reason) {
        setError(reason);
        break;
      }

      try {
        const result = await uploadFile(`folders/${folderId}`, file, (fraction) => {
          setStatus(`Uploading ${Math.round(fraction * 100)}%${position}`);
        });

        setStatus(`Saving${position}`);
        await registerUpload({
          folderId,
          name: file.name,
          bytes: result.bytes,
          mime: result.mime,
          storagePath: result.path,
          downloadUrl: result.downloadUrl,
        });
      } catch (cause) {
        // Storage also rejects oversize files at the rule level — that case
        // still falls back to this generic message since the SDK's own
        // error text for it isn't much clearer.
        setError(
          cause instanceof Error && cause.name === "NotSignedInError"
            ? cause.message
            : `Couldn't upload ${file.name}.`,
        );
        break;
      }
    }

    setStatus(null);
    // The folder list is server-rendered, so it only picks up the new rows
    // once the route re-runs.
    router.refresh();
  };

  return { status, error, uploadFiles, busy: status !== null };
}

export function UploadButton({ folderId }: { folderId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, error, uploadFiles, busy } = useFolderUpload(folderId);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          // Allows re-selecting the same file after a failure.
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <UploadIcon className="size-3.5" strokeWidth={1.8} />
        {status ?? "Upload or Drag"}
        <ChevronDownIcon className="size-3.5 opacity-70" strokeWidth={1.8} />
      </button>

      {error ? (
        <p role="alert" className="text-k-red text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
