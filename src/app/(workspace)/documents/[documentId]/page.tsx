import { FileTextIcon, MoreHorizontalIcon, StarIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { RichText } from "@/components/conversation/rich-text";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { getDocument, getFolder, getPerson } from "@/lib/kitchen-data";
import { formatShortDate } from "@/lib/kitchen-format";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const doc = await getDocument(documentId);
  if (!doc) notFound();

  const folder = await getFolder(doc.folderId);
  const author = await getPerson(doc.authorId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemTopBar
        breadcrumb={folder?.name ?? ""}
        participants={[doc.authorId]}
        shareTitle={doc.name}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Narrow measure — documents are for reading, not for filling width. */}
        <article className="mx-auto max-w-[680px] px-8 pt-6 pb-16">
          <div className="flex items-center gap-2">
            <FileTextIcon
              className="size-[18px] shrink-0 text-k-black-56"
              strokeWidth={1.6}
            />
            <h1 className="min-w-0 flex-1 font-semibold text-k-black-84 text-title">
              {doc.name}
            </h1>
            <button
              type="button"
              aria-label="Favourite"
              className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
            >
              <StarIcon className="size-4" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              aria-label="More"
              className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
            >
              <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 border-k-black-06 border-b pb-5">
            <PersonAvatar personId={doc.authorId} className="size-5" />
            <span className="text-k-black-56 text-md">{author?.name}</span>
            <span className="text-k-black-36 text-md">
              Updated {formatShortDate(doc.updatedAt)}
            </span>
          </div>

          <div className="mt-6">
            <RichText blocks={doc.blocks} />
          </div>
        </article>
      </div>
    </div>
  );
}
