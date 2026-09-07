"use client";

/**
 * Prefixes the browser tab's title with `(N)` while there's unread activity
 * — the one signal that reaches a backgrounded/unfocused tab, where a red
 * sidebar dot can't. Re-runs on every navigation (not just every count
 * change): Next sets a fresh, unprefixed `document.title` per page before
 * this effect fires, so re-deriving from the live title each time is what
 * keeps the prefix from going stale across route changes.
 */
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PREFIX_RE = /^\(\d+\+?\)\s*/;

export function TabTitleBadge({ count }: { count: number }) {
  const pathname = usePathname();

  useEffect(() => {
    const base = document.title.replace(PREFIX_RE, "");
    document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
  }, [count, pathname]);

  return null;
}
