"use client";

import {
  SearchIcon,
  FolderIcon,
  MessageCircleIcon,
  FileTextIcon,
  ColumnsIcon,
  LinkIcon,
  BuildingIcon,
  UserIcon,
  FileIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState, useTransition, useRef } from "react";
import { useWorkspace, useOrgSlug } from "@/components/workspace-provider";
import { isEnabled } from "@/lib/kitchen-flags";
import { useRouter } from "next/navigation";
import {
  searchWorkspaceAction,
  type SearchResult,
} from "@/app/(workspace)/search-actions";

function getIcon(type: string) {
  switch (type) {
    case "folder":
      return <FolderIcon className="size-4 text-k-gray-ad" />;
    case "conversation":
      return <MessageCircleIcon className="size-4 text-k-gray-ad" />;
    case "document":
      return <FileTextIcon className="size-4 text-k-gray-ad" />;
    case "board":
      return <ColumnsIcon className="size-4 text-k-gray-ad" />;
    case "embed":
      return <LinkIcon className="size-4 text-k-gray-ad" />;
    case "organization":
      return <BuildingIcon className="size-4 text-k-gray-ad" />;
    case "person":
      return <UserIcon className="size-4 text-k-gray-ad" />;
    case "file":
    default:
      return <FileIcon className="size-4 text-k-gray-ad" />;
  }
}

/**
 * The search pill in the top bar plus its ⌘K overlay.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const workspace = useWorkspace();
  const orgSlug = useOrgSlug();
  const enabled = isEnabled("globalSearch");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length > 0) {
        startTransition(async () => {
          const res = await searchWorkspaceAction(query, orgSlug);
          setResults(res);
          setSelectedIndex(0);
        });
      } else {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(handler);
  }, [query, orgSlug]);

  const placeholder = `Search ${workspace.name}...`;

  if (!enabled) return null;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]?.url) {
        router.push(results[selectedIndex].url);
        setOpen(false);
      }
    }
  }

// ... existing code ...

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

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-k-black-24 pt-[12vh]"
              onClick={() => setOpen(false)}
              role="presentation"
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-through guard */}
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Search"
                className="w-[600px] max-w-[calc(100vw-32px)] overflow-hidden rounded-3xl bg-background border border-k-black-08 flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex h-12 items-center gap-2 pr-3 pl-4 shrink-0 border-b border-k-black-06">
                  <SearchIcon
                    className="size-5 shrink-0 text-k-gray-ad"
                    strokeWidth={1.7}
                  />
                  {/* biome-ignore lint/a11y/noAutofocus: expected for a command palette */}
                  <input
                    ref={inputRef}
                    autoFocus
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-full flex-1 bg-transparent text-[18px] text-k-black outline-none placeholder:text-k-gray-ad"
                  />
                  {isPending && (
                    <div className="size-4 rounded-full border-2 border-k-black-12 border-t-k-black-40 animate-spin shrink-0" />
                  )}
                </div>

                <div className="overflow-y-auto">
                  {results.length > 0 ? (
                    <ul className="py-2">
                      {results.map((result, i) => {
                        const isSelected = i === selectedIndex;
                        return (
                          <li key={result.id} className="px-2">
                            <button
                              type="button"
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                isSelected ? "bg-k-black-04" : "hover:bg-k-black-02"
                              }`}
                              onClick={() => {
                                if (result.url) {
                                  router.push(result.url);
                                  setOpen(false);
                                }
                              }}
                              onMouseEnter={() => setSelectedIndex(i)}
                            >
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-k-black-02">
                                {getIcon(result.type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-k-black text-md font-medium">
                                  {result.title}
                                </div>
                                {result.subtitle && (
                                  <div className="truncate text-k-black-40 text-sm">
                                    {result.subtitle}
                                  </div>
                                )}
                              </div>
                              <div className="text-k-black-40 text-sm capitalize">
                                {result.type}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : query.trim().length > 0 && !isPending ? (
                    <div className="px-4 py-8 text-center text-k-black-40 text-md">
                      No results found for "{query}"
                    </div>
                  ) : query.trim().length === 0 ? (
                    <div className="px-4 py-8 text-center text-k-black-40 text-md">
                      Start typing to search.
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-k-black-40 text-md">
                      Searching...
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
