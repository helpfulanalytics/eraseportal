import { notFound } from "next/navigation";
import { BlockEditor } from "@/components/document/block-editor";
import { CanvasBoard } from "@/components/document/canvas-board";
import { DocumentTitle } from "@/components/document/document-title";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { requireFolderAccess } from "@/lib/access-guard";
import { docBlocksOf, documentKind } from "@/lib/doc-blocks";
import { getDocument, getFolder, getPerson } from "@/lib/kitchen-data";
import { formatShortDate } from "@/lib/kitchen-format";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ orgSlug: string; documentId: string }>;
}) {
  const { documentId } = await params;
  const doc = await getDocument(documentId);
  if (!doc) notFound();

  const folder = await getFolder(doc.folderId);
  const me = await requireFolderAccess(folder);
  const author = await getPerson(doc.authorId);

  // Editing is members-only, matching who can create a document at all. A
  // client in the same organization reads it — see `requireDocumentAccess`
  // in actions.ts, which is what actually enforces this.
  const editable = me.kind === "member";
  const kind = documentKind(doc);

  if (kind === "canvas") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ItemTopBar
          breadcrumb={folder?.name ?? ""}
          participants={[doc.authorId]}
          shareTitle={doc.name}
        />

        <div className="flex shrink-0 items-center gap-2 px-5 pb-1">
          <DocumentTitle
            documentId={doc.id}
            folderId={doc.folderId}
            name={doc.name}
            editable={editable}
            starred={doc.starred}
            size="compact"
          />
        </div>

        <CanvasBoard
          documentId={doc.id}
          initialNodes={doc.nodes ?? []}
          editable={editable}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemTopBar
        breadcrumb={folder?.name ?? ""}
        participants={[doc.authorId]}
        shareTitle={doc.name}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/*
          Narrow measure — a document is for reading, not for filling the
          width. The 52px left gutter is where the block handles live, and
          the title sits inside it with the text, so the whole column lines
          up and the controls hang off it.
        */}
        <article className="mx-auto max-w-[812px] px-8 pt-2 pb-16">
          <div className="pl-[52px]">
            <DocumentTitle
              documentId={doc.id}
              folderId={doc.folderId}
              name={doc.name}
              editable={editable}
              starred={doc.starred}
            />

            <div className="mt-3 mb-6 flex items-center gap-2 border-k-black-06 border-b pb-5">
              <PersonAvatar personId={doc.authorId} className="size-5" />
              <span className="text-k-black-56 text-md">{author?.name}</span>
              <span className="text-k-black-36 text-md">
                Updated {formatShortDate(doc.updatedAt)}
              </span>
            </div>

            <BlockEditor
              documentId={doc.id}
              initialBlocks={docBlocksOf(doc)}
              editable={editable}
            />
          </div>
        </article>
      </div>
    </div>
  );
}
