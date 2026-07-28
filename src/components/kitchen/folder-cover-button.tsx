"use client";

/**
 * Wires the folder page's "Change cover" icon button, which existed as a
 * dead `HeaderIconButton` before this — labelled, styled, and doing nothing.
 *
 * Same two-step upload as `UploadButton`: bytes go straight from the browser
 * to Storage, then a server action records the resulting URL. Reuses the
 * exact `folders/{folderId}` Storage prefix a regular file upload uses
 * rather than a `folders/{folderId}/cover` subpath — storage.rules only has
 * a match block for that one shape, and a cover subfolder would need a rules
 * change this doesn't need.
 */
import { useRef, useState } from "react";
import { GalleryVerticalEndIcon } from "lucide-react";
import { setFolderCoverAction } from "@/app/(workspace)/actions";
import { uploadFile } from "@/lib/firebase/storage";

export function FolderCoverButton({ folderId }: { folderId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    // storage.rules blocks HTML/SVG/XHTML content types outright, but
    // nothing stops a PDF or a .zip from reaching this input — cheap to
    // check client-side before spending an upload on something that will
    // never render as a background image.
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { done } = uploadFile(`folders/${folderId}`, file);
      const result = await done;
      await setFolderCoverAction(folderId, result.downloadUrl);
    } catch {
      setError("Couldn't set that as the cover.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <button
        type="button"
        aria-label="Change cover"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-60"
      >
        <GalleryVerticalEndIcon className="size-4" strokeWidth={1.6} />
      </button>
      {error ? (
        <p role="alert" className="text-k-red text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
