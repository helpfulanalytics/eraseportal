/**
 * Pure presentation helpers. No data access, so both server and client
 * components can import these directly.
 */
import type { FolderItem } from "./kitchen-types";

/** Route for a folder item, by kind. */
export function itemHref(item: FolderItem): string | undefined {
  switch (item.kind) {
    case "conversation":
      return `/conversations/${item.id}`;
    case "board":
      return `/boards/${item.id}`;
    case "document":
      return `/documents/${item.id}`;
    case "embed":
      return `/embeds/${item.id}`;
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

/** "40.7 kB" — matches the metadata line on file rows. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const kb = bytes / 1000;
  if (kb < 1000) return `${kb.toFixed(kb < 100 ? 2 : 1).replace(/\.?0+$/, "")} kB`;
  return `${(kb / 1000).toFixed(2)} MB`;
}
