import type { Metadata } from "next";
import { FolderIcon, MessageSquareIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { FolderCoverButton } from "@/components/kitchen/folder-cover-button";
import {
  FolderContents,
  type FolderRow,
} from "@/components/kitchen/folder-contents";
import { FolderDescription } from "@/components/kitchen/folder-description";
import { FolderHeaderControls } from "@/components/kitchen/folder-header-controls";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { CreateMenu } from "@/components/kitchen/create-menu";
import { FolderTile, type FolderBoardItem } from "@/components/kitchen/folder-board";
import { StarButton } from "@/components/kitchen/star-button";
import { UploadButton } from "@/components/kitchen/upload-button";
import { requireFolderAccess } from "@/lib/access-guard";
import {
  getDocumentPreviews,
  getEmbedUrls,
  getFolder,
  getFolderItems,
  getFolders,
  getFolderUnreadCounts,
  getOrganizations,
} from "@/lib/kitchen-data";
import {
  formatBytes,
  formatRelativeTime,
  formatShortDate,
  formatUrl,
  itemHref,
} from "@/lib/kitchen-format";
import type { FolderItem, ItemMeta } from "@/lib/kitchen-types";

/**
 * Grey second line under an item's name.
 *
 * A document shows its own first line, denormalised onto the item by
 * `saveDocumentContent` — reading every document to render one folder would
 * be a query per row. Documents saved before that existed have no preview and
 * fall back to their timestamp.
 */
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

/** The client component takes flat rows so it never touches the domain types. */
function toRow(
  item: FolderItem,
  orgSlug: string,
  previews: Record<string, string>,
  embedUrls: Record<string, string>,
  unreadCounts: Record<string, number>,
): FolderRow {
  const row: FolderRow = {
    id: item.id,
    kind: item.kind,
    name: item.name,
    subtitle: previews[item.id] ?? itemSubtitle(item.meta),
    createdAt: item.createdAt,
    authorId: item.authorId,
    href: itemHref(item, orgSlug),
    unreadCount: unreadCounts[item.id],
  };

  if (item.meta.type === "file") {
    // No `href`: an upload has no page. `file` is what opens the preview.
    row.file = {
      name: item.name,
      label: item.meta.label,
      bytes: item.meta.bytes,
      mime: item.meta.mime,
      url: item.meta.url,
    };
  }

  if (item.meta.type === "document" && item.meta.docKind === "canvas") {
    row.variant = "canvas";
  }
  if (item.meta.type === "embed") {
    if (item.meta.provider === "Link") {
      row.variant = "link";
    }
    const url = embedUrls[item.id];
    if (url) {
      row.embedUrl = url;
      if (item.meta.provider === "Link") {
        row.subtitle = formatUrl(url);
      } else {
        row.subtitle = `${item.meta.provider} • ${formatUrl(url)}`;
      }
    }
  }

  return row;
}

// Next 16: params is a Promise and must be awaited.
type PageProps = {
  params: Promise<{ orgSlug: string; folderId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { folderId } = await params;
  const folder = await getFolder(folderId);
  if (!folder) return {};
  
  return {
    title: folder.name,
    openGraph: {
      images: [`/api/og?title=${encodeURIComponent(folder.name)}&type=Folder`],
    },
    twitter: {
      images: [`/api/og?title=${encodeURIComponent(folder.name)}&type=Folder`],
    },
  };
}

export default async function FolderPage({ params }: PageProps) {
  const { orgSlug, folderId } = await params;
  const folderMaybe = await getFolder(folderId);
  const me = await requireFolderAccess(folderMaybe);
  if (!folderMaybe) notFound();
  const folder = folderMaybe;
  const isAdmin = me.kind === "member";
  const organizations = isAdmin ? await getOrganizations() : [];

  const subfolders = folder.organizationId
    ? await getFolders({ organizationId: folder.organizationId, parentFolderId: folderId })
    : (await getFolders()).filter((f) => f.parentFolderId === folderId);

  const items = await getFolderItems(folderId);
  const participants = [...new Set(items.map((i) => i.authorId))];
  const unreadCounts = await getFolderUnreadCounts(folderId, me.id);

  // Documents saved before the listing showed a preview have none stored.
  // One batched read fills those in; it costs nothing once each has been
  // saved, since saving writes the preview.
  const previews = await getDocumentPreviews(
    items
      .filter((i) => i.meta.type === "document" && !i.meta.preview)
      .map((i) => i.id),
  );

  const embedUrls = await getEmbedUrls(
    items.filter((i) => i.meta.type === "embed").map((i) => i.id),
  );

  return (
    <div className="flex min-h-full flex-col">
      <ItemTopBar
        breadcrumb={folder.name}
        participants={participants}
        shareTitle={folder.name}
        resourceId={folderId}
        resourceType="folder"
        roles={folder.roles}
        authorId={folder.authorId}
      />

      {folder.coverUrl ? (
        // External Storage URL; this app has no next/image remote-pattern
        // config, and adding one for a single cover image isn't worth it yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={folder.coverUrl}
          alt=""
          className="h-56 w-full object-cover"
        />
      ) : (
        <div
          className="flex h-56 items-center justify-center bg-k-gray-f8"
          aria-hidden="true"
        >
          <FolderIcon
            className="size-24 opacity-90"
            style={{
              color: folder.color ?? "var(--k-yellow)",
              fill: folder.color ?? "var(--k-yellow)",
            }}
            strokeWidth={1}
          />
        </div>
      )}

      <div className="px-12 pt-10 pb-12">
        <div className="flex items-center gap-3">
          <FolderHeaderControls
            folderId={folderId}
            name={folder.name}
            color={folder.color}
            itemCount={folder.itemIds.length}
            triggerClassName="mt-1.5"
          />
          <div className="flex items-center gap-0.5 pt-1.5">
            <StarButton kind="folder" id={folderId} starred={folder.starred} />
            <FolderCoverButton folderId={folderId} />
            <FolderDescription
              folderId={folderId}
              description={folder.description}
              editable={isAdmin}
            />
          </div>
        </div>

        {folder.url ? (
          <a
            href={folder.url}
            className="mt-1.5 block text-k-black-40 text-md hover:text-k-blue hover:underline"
          >
            {formatUrl(folder.url)}
          </a>
        ) : null}

        {subfolders.length > 0 ? (
          <section className="mt-7">
            <h2 className="mb-3 font-medium text-k-black-56 text-md">Subfolders</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subfolders.map((sub) => {
                const item: FolderBoardItem = {
                  id: sub.id,
                  href: `/w/${orgSlug}/folders/${sub.id}`,
                  title: sub.name,
                  subtitle: sub.description,
                  meta: `${sub.itemIds.length} item${sub.itemIds.length === 1 ? "" : "s"}`,
                  activityLabel: sub.updatedAt
                    ? `Updated ${formatRelativeTime(sub.updatedAt)}`
                    : undefined,
                  color: sub.color,
                };
                return <FolderTile key={sub.id} item={item} href={item.href} />;
              })}
            </div>
          </section>
        ) : null}

        <FolderContents
          folderId={folderId}
          rows={items.map((item) => toRow(item, orgSlug, previews, embedUrls, unreadCounts))}
          canManage={isAdmin}
          toolbarRight={
            <>
              {isAdmin ? (
                <>
                  {/* Conversations are the most common thing started from a
                      folder, so admins get a one-click shortcut alongside
                      the full Create menu instead of having to open it and
                      pick "Conversation" from seven rows every time. */}
                  <CreateMenu
                    folderId={folderId}
                    initial="conversation"
                    triggerClassName="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-06 px-3 text-k-black-84 hover:bg-k-black-08"
                  >
                    <MessageSquareIcon className="size-3.5" strokeWidth={1.8} />
                    New conversation
                  </CreateMenu>
                  <CreateMenu
                    folderId={folderId}
                    orgSlug={orgSlug}
                    organizations={organizations}
                    triggerClassName="h-8 gap-1.5 rounded-lg bg-k-black-06 px-3 text-k-black-84 hover:bg-k-black-08"
                  />
                </>
              ) : (
                // Clients can only start conversations here — everything else
                // this menu offers (board/document/embed/folder) is admin-only.
                <CreateMenu
                  folderId={folderId}
                  initial="conversation"
                  triggerClassName="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-06 px-3 text-k-black-84 hover:bg-k-black-08"
                >
                  <MessageSquareIcon className="size-3.5" strokeWidth={1.8} />
                  New conversation
                </CreateMenu>
              )}
              {isAdmin ? <UploadButton folderId={folderId} /> : null}
            </>
          }
        />
      </div>
    </div>
  );
}
