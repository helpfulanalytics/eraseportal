import {
  AlignLeftIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderIcon,
  GalleryVerticalEndIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  UploadIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { DataTable, type Row } from "@/components/kitchen/data-table";
import { FileThumb } from "@/components/kitchen/file-thumb";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { getFolder, getFolderItems } from "@/lib/kitchen-data";
import { formatBytes, formatShortDate, itemHref } from "@/lib/kitchen-format";
import type { ItemMeta } from "@/lib/kitchen-types";

/** Grey metadata line under an item name, by kind. */
function itemSubtitle(meta: ItemMeta): string | null {
  switch (meta.type) {
    case "conversation":
      return `${meta.messageCount} messages`;
    case "file":
      return `${meta.label} • ${formatBytes(meta.bytes)}`;
    case "board":
      return `${meta.cardCount} cards`;
    case "document":
      return `Updated ${formatShortDate(meta.updatedAt)}`;
    case "embed":
      return meta.provider;
    default:
      return null;
  }
}

// Next 16: params is a Promise and must be awaited.
export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const folder = await getFolder(folderId);
  if (!folder) notFound();

  const items = await getFolderItems(folderId);
  const participants = [
    ...new Set(items.map((i) => i.authorId)),
  ];

  const rows: Row[] = items.map((item) => ({
    id: item.id,
    href: itemHref(item),
    cells: {
      name: (
        <div className="flex min-w-0 items-center gap-3">
          <ItemIcon kind={item.kind} />
          <div className="min-w-0">
            <div className="truncate text-k-black-84 text-md">{item.name}</div>
            <div className="truncate text-k-black-40 text-md">
              {itemSubtitle(item.meta)}
            </div>
          </div>
        </div>
      ),
      created: formatShortDate(item.createdAt),
    },
  }));

  return (
    <div className="flex min-h-full flex-col">
      <ItemTopBar
        breadcrumb={folder.name}
        participants={participants}
        shareTitle={folder.name}
      />

      <div
        className="flex h-56 items-center justify-center bg-k-gray-f8"
        aria-hidden="true"
      >
        <FolderIcon
          className="size-24 fill-k-yellow text-k-yellow opacity-90"
          strokeWidth={1}
        />
      </div>

      <div className="px-12 pt-10 pb-12">
        <div className="flex items-center gap-3">
          <FolderIcon
            className="size-8 shrink-0 fill-k-yellow text-k-yellow"
            strokeWidth={1.3}
          />
          <h1 className="font-semibold text-k-black-84 text-title">
            {folder.name}
          </h1>
          <div className="flex items-center gap-0.5 pt-1.5">
            <HeaderIconButton label="Favourite">
              <StarIcon className="size-4" strokeWidth={1.6} />
            </HeaderIconButton>
            <HeaderIconButton label="Change cover">
              <GalleryVerticalEndIcon className="size-4" strokeWidth={1.6} />
            </HeaderIconButton>
            <HeaderIconButton label="Toggle description">
              <AlignLeftIcon className="size-4" strokeWidth={1.6} />
            </HeaderIconButton>
          </div>
        </div>

        {folder.url ? (
          <a
            href={folder.url}
            className="mt-1.5 block text-k-black-40 text-md hover:text-k-blue hover:underline"
          >
            {folder.url}
          </a>
        ) : null}

        <div className="mt-7 flex items-center gap-2">
          <div className="flex h-8 w-60 items-center gap-2 rounded-lg border border-k-black-08 px-3 text-k-gray-ad text-md">
            <SearchIcon className="size-3.5 shrink-0" strokeWidth={1.7} />
            <span>Search this folder...</span>
          </div>
          <FilterChip label="Author" />
          <FilterChip label="Created" />

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-06 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-08"
            >
              <PlusIcon className="size-3.5" strokeWidth={1.8} />
              Create
              <ChevronDownIcon className="size-3.5 opacity-60" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
            >
              <UploadIcon className="size-3.5" strokeWidth={1.8} />
              Upload or Drag
              <ChevronDownIcon className="size-3.5 opacity-70" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <DataTable
          className="mt-7"
          columns={[
            { key: "name", label: "Name" },
            { key: "created", label: "Created", width: "160px" },
          ]}
          rows={rows}
          empty="This folder is empty."
          headerAction={
            <button
              type="button"
              aria-label="Switch layout"
              className="flex size-6 items-center justify-center rounded-md text-k-black-24 transition-colors hover:bg-k-black-04 hover:text-k-black-72"
            >
              <LayoutGridIcon className="size-4" strokeWidth={1.7} />
            </button>
          }
        />
      </div>
    </div>
  );
}

const KIND_GLYPH = {
  conversation: MessageSquareIcon,
  board: LayoutTemplateIcon,
  document: FileTextIcon,
  embed: LinkIcon,
} as const;

function ItemIcon({ kind }: { kind: string }) {
  // Files get a page-shaped thumbnail; everything else gets its type glyph.
  if (kind === "file") return <FileThumb />;

  const Glyph = KIND_GLYPH[kind as keyof typeof KIND_GLYPH];
  if (!Glyph) return <FileThumb />;

  return (
    <span className="flex size-8 shrink-0 items-center justify-center text-k-black-56">
      <Glyph className="size-[18px]" strokeWidth={1.6} />
    </span>
  );
}

function HeaderIconButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
    >
      {children}
    </button>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-8 items-center gap-1 rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
    >
      {label}
      <ChevronDownIcon className="size-3.5 opacity-50" strokeWidth={1.8} />
    </button>
  );
}
