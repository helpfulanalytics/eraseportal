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
 * The search pill in the top bar.
 *
 * Expands in place rather than opening a modal: the pill becomes the input
 * and results drop down directly beneath it, anchored inside this component's
 * own `relative` wrapper. No backdrop, no portal, no `fixed inset-0` overlay —
 * the rest of the page stays visible and interactive, which is what "opening
 * a new modal search box" was doing wrong.
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

  const containerRef = useRef<HTMLDivElement>(null);
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

  // Click anywhere outside the pill closes it — the same dismissal a modal's
  // backdrop gave for free, without needing a backdrop to get it.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Focus lands after the input mounts, not before.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  /** Clears the query only on the open→close edge, not on every render while closed. */
  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }

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
      close();
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
        close();
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex h-8 w-[420px] items-center gap-2 rounded-lg border bg-background px-3 text-md transition-colors ${
          open ? "border-k-black-16" : "border-k-black-08 hover:border-k-black-12"
        }`}
      >
        <SearchIcon
          className="size-3.5 shrink-0 text-k-gray-ad"
          strokeWidth={1.7}
        />
        <input
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-full flex-1 truncate bg-transparent text-k-black outline-none placeholder:text-k-gray-ad"
        />
        {isPending && (
          <div className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-k-black-12 border-t-k-black-40" />
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-[70vh] w-[420px] overflow-hidden overflow-y-auto rounded-xl border border-k-black-08 bg-background shadow-lg"
        >
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
                          close();
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
              No results found for &ldquo;{query}&rdquo;
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
      )}
    </div>
  );
}
