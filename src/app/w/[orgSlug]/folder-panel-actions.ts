"use server";

/**
 * Read for the workspace home's folder-details right panel — fetched on
 * demand when a client selects a folder card, rather than eagerly for every
 * folder up front (a folder can hold tens of items; the dashboard only ever
 * shows one panel at a time).
 */
import { getCurrentUser, getFolder, getFolderItems, getFolders } from "@/lib/kitchen-data";
import { formatBytes, formatShortDate, itemHref } from "@/lib/kitchen-format";
import type { ItemKind, ItemMeta } from "@/lib/kitchen-types";

export interface FolderPanelRow {
  id: string;
  /** `"folder"` marks a subfolder — the only kind not in `ItemKind`. */
  kind: ItemKind | "folder";
  name: string;
  subtitle: string;
  href?: string;
}

function itemSubtitle(meta: ItemMeta): string {
  switch (meta.type) {
    case "conversation":
      return `${meta.messageCount} message${meta.messageCount === 1 ? "" : "s"}`;
    case "file":
      return `${meta.label} • ${formatBytes(meta.bytes)}`;
    case "board":
      return `${meta.cardCount} card${meta.cardCount === 1 ? "" : "s"}`;
    case "document":
      return meta.preview?.trim()
        ? meta.preview
        : `Updated ${formatShortDate(meta.updatedAt)}`;
    case "embed":
      return meta.provider;
    default:
      return "";
  }
}

/**
 * Throws rather than calling `notFound()`/`redirect()` — this runs inside a
 * server action, where the caller is a `fetch` from the panel, not a page
 * render. Same boundary as `requireFolderAccess`, just action-shaped like
 * `requireInboxScope`.
 */
export async function getFolderPanelItems(
  folderId: string,
  orgSlug: string,
): Promise<FolderPanelRow[]> {
  const folder = await getFolder(folderId);
  if (!folder) throw new Error("Folder not found.");

  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");
  if (me.kind === "client") {
    if (folder.organizationId !== me.organizationId) {
      throw new Error("You don't have access to that folder.");
    }
    if (folder.authorId !== me.id && !folder.roles?.[me.id]) {
      throw new Error("You don't have access to that folder.");
    }
  }

  const subfolders = folder.organizationId
    ? await getFolders({ organizationId: folder.organizationId, parentFolderId: folderId })
    : [];
  const subfolderRows: FolderPanelRow[] = subfolders.map((sub) => ({
    id: sub.id,
    kind: "folder",
    name: sub.name,
    subtitle: `${sub.itemIds.length} item${sub.itemIds.length === 1 ? "" : "s"}`,
    href: `/w/${orgSlug}/folders/${sub.id}`,
  }));

  const items = await getFolderItems(folderId);
  const itemRows: FolderPanelRow[] = items.slice(0, 8).map((item) => ({
    id: item.id,
    kind: item.kind,
    name: item.name,
    subtitle: itemSubtitle(item.meta),
    href: itemHref(item, orgSlug),
  }));

  return [...subfolderRows, ...itemRows];
}
