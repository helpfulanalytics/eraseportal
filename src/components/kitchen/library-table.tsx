"use client";

/**
 * The Library's file list.
 *
 * A client component for the same reason the folder listing is one: a file
 * has no page to navigate to, so opening one means showing a preview here.
 * Search is real too — the box above the table used to be a `<div>` with
 * placeholder text in it.
 */
import { useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import {
  FilePreviewDialog,
  type PreviewFile,
} from "@/components/kitchen/file-preview-dialog";
import { ItemThumb } from "@/components/kitchen/item-thumb";
import { formatBytes, formatShortDate } from "@/lib/kitchen-format";
import type { LibraryFile } from "@/lib/kitchen-types";

export function LibraryTable({
  files,
  authors,
}: {
  files: LibraryFile[];
  /** Author name per file id, resolved on the server. */
  authors: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((file) =>
      `${file.name} ${file.source} ${file.label} ${authors[file.id] ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [files, query, authors]);

  return (
    <>
      <div className="mt-7 flex items-center gap-2">
        <div className="flex h-8 w-64 items-center gap-2 rounded-lg border border-k-black-08 px-3 focus-within:border-k-blue">
          <SearchIcon className="size-3.5 shrink-0 text-k-gray-ad" strokeWidth={1.7} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
            placeholder={`Search ${files.length} ${files.length === 1 ? "file" : "files"}...`}
            className="min-w-0 flex-1 bg-transparent text-k-black-84 text-md outline-none placeholder:text-k-gray-ad"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="shrink-0 text-k-black-36 transition-colors hover:text-k-black-84"
            >
              <XIcon className="size-3.5" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-7 w-full">
        <div className="flex items-center gap-4 border-k-black-06 border-b px-3 pb-2 text-k-black-40 text-md">
          <div className="min-w-0 flex-1">Name</div>
          <div className="w-[260px] shrink-0">Location</div>
          <div className="w-[160px] shrink-0">Author</div>
          <div className="w-[120px] shrink-0">Created</div>
        </div>

        {visible.length === 0 ? (
          <p className="border-k-black-06 border-b py-8 text-center text-k-black-40 text-md">
            {files.length === 0 ? "No files yet." : `Nothing matches "${query}".`}
          </p>
        ) : (
          <ul>
            {visible.map((file) => (
              <li
                key={`${file.source}-${file.id}`}
                className="border-k-black-06 border-b transition-colors hover:bg-k-black-02"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPreview({
                      name: file.name,
                      label: file.label,
                      bytes: file.bytes,
                      mime: file.mime,
                      url: file.url,
                    })
                  }
                  className="flex w-full items-center gap-4 px-3 py-2.5 text-left"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <ItemThumb
                      subject={{
                        kind: "file",
                        file: { label: file.label, mime: file.mime, url: file.url },
                      }}
                      name={file.name}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-k-black-84 text-md">
                        {file.name}
                      </span>
                      <span className="block truncate text-k-black-40 text-md">
                        {file.label} • {formatBytes(file.bytes)}
                      </span>
                    </span>
                  </span>
                  <span className="w-[260px] shrink-0 truncate text-k-black-56 text-md">
                    {file.source}
                  </span>
                  <span className="w-[160px] shrink-0 truncate text-k-black-56 text-md">
                    {authors[file.id] ?? "—"}
                  </span>
                  <span className="w-[120px] shrink-0 text-k-black-56 text-md">
                    {formatShortDate(file.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview ? (
        <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}
