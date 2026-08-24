/**
 * Pure presentation helpers. No data access, so both server and client
 * components can import these directly.
 */
import type { Block, FolderItem, Inline } from "./kitchen-types";

/**
 * Fixed swatch set shared by board colour, folder colour, and person avatar
 * tints — the same five `--k-*` tokens the seeded people already use, rather
 * than an arbitrary hex picker. Both server (the default colour on
 * `createBoard`) and client (the swatch pickers) need this list, which is
 * why it lives here rather than in kitchen-data.ts: that module throws if
 * imported from the browser.
 */
export const SWATCH_COLORS = [
  "var(--k-blue)",
  "var(--k-purple)",
  "var(--k-green-0e)",
  "var(--k-yellow)",
  "var(--k-red)",
] as const;

/**
 * Mirrors `safeContentType()` in `storage.rules` — SVG and HTML are blocked
 * there because both can carry executable script and run it from the
 * bucket's own origin. Checking here too means a rejected upload shows a
 * specific message ("SVGs aren't allowed") instead of a raw failed request;
 * the rule is still what actually enforces it; this is only for the message.
 */
export function unsupportedImageReason(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Choose an image file.";
  return blockedUploadReason(file);
}

/**
 * The general-purpose version — for the folder Upload button, which takes
 * any file type, not just images. Still blocks SVG/HTML/XHTML specifically,
 * same reason as above.
 */
export function blockedUploadReason(file: File): string | null {
  if (file.type.match(/^image\/svg/)) {
    return "SVGs aren't allowed (they can contain scripts) — try PNG or JPG.";
  }
  if (file.type.match(/^text\/html/) || file.type.match(/^application\/xhtml/)) {
    return "HTML files aren't allowed (they can contain scripts).";
  }
  return null;
}

/** Route for a folder item, by kind — scoped to its org's workspace portal. */
export function itemHref(item: FolderItem, orgSlug: string): string | undefined {
  switch (item.kind) {
    case "conversation":
      return `/w/${orgSlug}/conversations/${item.id}`;
    case "board":
      return `/w/${orgSlug}/boards/${item.id}`;
    case "document":
      return `/w/${orgSlug}/documents/${item.id}`;
    case "embed":
      return `/w/${orgSlug}/embeds/${item.id}`;
    default:
      return undefined;
  }
}

/** "Jun 10" — the short form used in message headers and table rows. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * "Feb 18, 2026, 4:45 PM" — comment and activity timestamps.
 *
 * Deliberately not UTC, unlike `formatShortDate`. A due date is a bare
 * calendar date with no real instant behind it, so reading it in UTC avoids
 * the date shifting by a day in negative-offset timezones. A comment's
 * `createdAt` is a genuine instant — `new Date().toISOString()` from the
 * moment it was posted — so showing it in the reader's local time is what's
 * actually correct here, not an inconsistency with the other formatter.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Escapes text interpolated into a notification email's HTML body. */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** "3h ago", "yesterday", "2w ago" — the dashboard card's activity stat. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatShortDate(iso);
}

/**
 * First line of a message body, flattened to plain text for a preview row.
 *
 * `handles` maps person id to @handle so a mention reads as "@chelsea" rather
 * than as a raw id. Optional because the caller may not have the people
 * directory to hand; without it a mention degrades to a bare "@".
 */
export function blockPreview(
  body: Block[],
  handles?: Record<string, string>,
): string {
  for (const block of body) {
    if (block.b === "p") {
      const text = inlineText(block.children, handles);
      if (text.trim()) return text.trim();
      continue;
    }
    if (block.b === "ul") {
      for (const item of block.items) {
        const text = inlineText(item.children, handles);
        if (text.trim()) return text.trim();
      }
      continue;
    }
    if (block.v.trim()) return block.v.trim();
  }
  return "";
}

/**
 * The inverse of `sendMessage`'s paragraph split: flattens a whole body back
 * to the plain text an edit's textarea should be prefilled with — mentions
 * back to `@handle`, links back to their href, one blank line between
 * paragraphs so re-sending it round-trips through `parseInline` unchanged.
 */
export function blocksToText(body: Block[], handles?: Record<string, string>): string {
  return body
    .map((block) => {
      if (block.b === "p") return inlineText(block.children, handles);
      if (block.b === "ul") {
        return block.items.map((item) => inlineText(item.children, handles)).join("\n");
      }
      return block.v;
    })
    .join("\n\n");
}

function inlineText(nodes: Inline[], handles?: Record<string, string>): string {
  return nodes
    .map((node) => {
      if (node.t === "mention") return `@${handles?.[node.personId] ?? ""}`;
      if (node.t === "link") return node.v ?? node.href;
      return node.v;
    })
    .join("");
}

/** "40.7 kB" — matches the metadata line on file rows. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const kb = bytes / 1000;
  if (kb < 1000) return `${kb.toFixed(kb < 100 ? 2 : 1).replace(/\.?0+$/, "")} kB`;
  return `${(kb / 1000).toFixed(2)} MB`;
}

/** 
 * Simplifies a URL for display by removing the protocol, www prefix, 
 * and truncating long paths (e.g. for folder links or embeds).
 */
export function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const search = parsed.search || "";
    const display = host + path + search;
    if (display.length > 40) {
      return display.slice(0, 37) + "…";
    }
    return display;
  } catch {
    if (url.length > 40) {
      return url.slice(0, 37) + "…";
    }
    return url;
  }
}
