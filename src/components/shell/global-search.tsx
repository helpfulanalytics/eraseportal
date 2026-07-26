"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";

/**
 * The search pill in the top bar plus its ⌘K overlay. The overlay is chrome
 * only for now — it renders the correct geometry and dismiss behaviour, but
 * has nothing to search until there's a real index.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const workspace = useWorkspace();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const placeholder = `Search ${workspace.name}...`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-[420px] items-center gap-2 rounded-lg border border-k-black-08 bg-background px-3 text-k-gray-ad text-md transition-colors hover:border-k-black-12"
      >
        <SearchIcon className="size-3.5 shrink-0" strokeWidth={1.7} />
        <span className="truncate">{placeholder}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-k-black-24 pt-[12vh]"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          role="presentation"
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-through guard */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-[600px] max-w-[calc(100vw-32px)] overflow-hidden rounded-3xl bg-background shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 items-center gap-2 pr-3 pl-4">
              <SearchIcon
                className="size-5 shrink-0 text-k-gray-ad"
                strokeWidth={1.7}
              />
              {/* biome-ignore lint/a11y/noAutofocus: expected for a command palette */}
              <input
                autoFocus
                placeholder={placeholder}
                className="h-full flex-1 bg-transparent text-[18px] text-k-black outline-none placeholder:text-k-gray-ad"
              />
            </div>
            <div className="border-k-black-06 border-t px-4 py-8 text-center text-k-black-40 text-md">
              Start typing to search.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
