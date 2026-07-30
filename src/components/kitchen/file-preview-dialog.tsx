"use client";

/**
 * Views an uploaded file without leaving the app.
 *
 * Uploads have been reachable-in-principle since Storage was wired up — the
 * download URL was written on every one and read by nothing, so a file in a
 * folder was a row you could see and not open. This is the other half.
 *
 * What renders depends on the content type, because a browser is already a
 * good viewer for most of what gets uploaded: images and PDFs display, audio
 * and video play, and everything else gets an honest "open it in a new tab or
 * download it" rather than an embed that shows a broken plugin.
 */
import { useEffect } from "react";
import { DownloadIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { formatBytes } from "@/lib/kitchen-format";

export interface PreviewFile {
  name: string;
  label: string;
  bytes: number;
  mime?: string;
  url?: string;
}

export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: PreviewFile;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mime = file.mime ?? "";
  const kind = mime.startsWith("image/")
    ? "image"
    : mime === "application/pdf"
      ? "pdf"
      : mime.startsWith("audio/")
        ? "audio"
        : mime.startsWith("video/")
          ? "video"
          : "other";

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-k-black-56 p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl bg-background shadow-xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-k-black-06 border-b px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-medium text-k-black-84 text-md">
              {file.name}
            </h2>
            <p className="text-k-black-40 text-sm">
              {file.bytes > 0
                ? `${file.label} • ${formatBytes(file.bytes)}`
                : file.label}
            </p>
          </div>

          {file.url ? (
            <>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
              >
                <ExternalLinkIcon className="size-3.5" strokeWidth={1.8} />
                Open
              </a>
              <a
                href={file.url}
                download={file.name}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
              >
                <DownloadIcon className="size-3.5" strokeWidth={1.8} />
                Download
              </a>
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <XIcon className="size-4.5" strokeWidth={1.7} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-k-gray-f8">
          {!file.url ? (
            <Message>
              This file was seeded as a fixture — there are no bytes behind it.
            </Message>
          ) : kind === "image" ? (
            // A Storage download URL isn't a configured next/image remote
            // pattern, and adding one per bucket for user uploads isn't worth
            // it — see the same note on the folder cover.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt={file.name}
              className="mx-auto max-h-[70vh] object-contain"
            />
          ) : kind === "pdf" ? (
            <iframe
              src={file.url}
              title={file.name}
              className="h-[70vh] w-full border-0"
            />
          ) : kind === "audio" ? (
            <div className="p-8">
              <audio src={file.url} controls className="w-full">
                <track kind="captions" />
              </audio>
            </div>
          ) : kind === "video" ? (
            <video src={file.url} controls className="max-h-[70vh] w-full bg-k-black">
              <track kind="captions" />
            </video>
          ) : (
            <Message>
              There&apos;s no preview for {file.label} files — open or download
              it instead.
            </Message>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-8 py-16 text-center text-k-black-40 text-md">{children}</p>
  );
}
