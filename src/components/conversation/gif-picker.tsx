"use client";

/**
 * The GIF button's picker: search GIPHY, click one, it attaches.
 *
 * Opens on trending rather than an empty grid — a picker that shows nothing
 * until you type is a search box wearing a picker's clothes.
 *
 * Falls back to the link field when `GIPHY_API_KEY` isn't set. That fallback
 * isn't a placeholder: a GIF is an image URL, so pasting one has always
 * worked and still does, and a clone without a key gets a working button
 * rather than a broken one.
 *
 * GIPHY's terms require visible attribution wherever their results appear —
 * the strip at the bottom is that, not decoration.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Link2Icon, SearchIcon, XIcon } from "lucide-react";
import {
  searchGifsAction,
  type GiphyResult,
} from "@/app/(workspace)/giphy-actions";
import type { GiphyGif } from "@/lib/giphy";
import { cn } from "@/lib/utils";

export function GifPicker({
  onPick,
  onPickLink,
  onClose,
}: {
  onPick: (gif: GiphyGif) => void;
  /** The manual escape hatch, also used when GIPHY isn't configured. */
  onPickLink: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GiphyResult | null>(null);
  const [link, setLink] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const search = useCallback((term: string) => {
    startTransition(async () => {
      try {
        setResult(await searchGifsAction(term));
      } catch {
        setResult({ configured: true, gifs: [], error: "Couldn't reach GIPHY." });
      }
    });
  }, []);

  // Trending on open.
  useEffect(() => {
    search("");
  }, [search]);

  // Debounced as you type — one request per pause, not per keystroke.
  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const unconfigured = result?.configured === false;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Add a GIF"
      className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-[420px] rounded-xl border border-k-black-08 bg-background shadow-popover"
    >
      {!unconfigured ? (
        <div className="flex items-center gap-2 border-k-black-06 border-b px-3 py-2.5">
          <SearchIcon className="size-3.5 shrink-0 text-k-gray-ad" strokeWidth={1.7} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIPHY…"
            aria-label="Search GIPHY"
            className="min-w-0 flex-1 bg-transparent text-k-black-84 text-md outline-none placeholder:text-k-gray-ad"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                search("");
              }}
              className="shrink-0 text-k-black-36 transition-colors hover:text-k-black-84"
            >
              <XIcon className="size-3.5" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-[280px] min-h-[140px] overflow-y-auto p-2">
        {unconfigured ? (
          <p className="px-2 py-6 text-center text-k-black-40 text-md">
            GIPHY search isn&apos;t set up — add <code>GIPHY_API_KEY</code> to
            the environment. You can still paste a GIF link below.
          </p>
        ) : result?.error ? (
          <p role="alert" className="px-2 py-6 text-center text-k-red text-md">
            {result.error}
          </p>
        ) : !result || (pending && result.gifs.length === 0) ? (
          <Skeletons />
        ) : result.gifs.length === 0 ? (
          <p className="px-2 py-6 text-center text-k-black-40 text-md">
            Nothing for &ldquo;{query}&rdquo;.
          </p>
        ) : (
          // A masonry-ish two-column grid: GIFs are wildly different shapes,
          // and forcing them into squares crops the joke out of most of them.
          <div className={cn("columns-2 gap-2", pending && "opacity-60")}>
            {result.gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onPick(gif)}
                title={gif.title}
                className="mb-2 block w-full overflow-hidden rounded-lg border border-transparent transition-colors hover:border-k-blue"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- giphy.com
                isn't a configured next/image remote pattern, and these are
                already CDN-optimised animated frames. */}
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-k-black-06 border-t px-3 py-2">
        <Link2Icon className="size-3.5 shrink-0 text-k-black-40" strokeWidth={1.7} />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onPickLink(link);
            }
          }}
          placeholder="…or paste a GIF or image link"
          aria-label="GIF or image link"
          className="min-w-0 flex-1 bg-transparent text-k-black-84 text-md outline-none placeholder:text-k-gray-ad"
        />
        <button
          type="button"
          onClick={() => onPickLink(link)}
          disabled={!link.trim()}
          className="h-7 shrink-0 rounded-md bg-k-black-06 px-2.5 text-k-black-84 text-sm transition-colors hover:bg-k-black-08 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {!unconfigured ? (
        <div className="border-k-black-06 border-t px-3 py-1.5 text-center text-k-black-36 text-2xs uppercase tracking-wider">
          Powered by GIPHY
        </div>
      ) : null}
    </div>
  );
}

function Skeletons() {
  const heights = [96, 128, 112, 88, 136, 104];
  return (
    <div aria-busy="true" aria-label="Loading GIFs" className="columns-2 gap-2">
      {heights.map((height, i) => (
        <span
          key={i}
          style={{ height }}
          className="mb-2 block w-full animate-pulse rounded-lg bg-k-black-04"
        />
      ))}
    </div>
  );
}
