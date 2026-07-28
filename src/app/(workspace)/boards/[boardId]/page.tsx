import { LayoutTemplateIcon, StarIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { BoardColumns } from "@/components/kitchen/board-columns";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { getBoard, getFolder } from "@/lib/kitchen-data";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const board = await getBoard(boardId);
  if (!board) notFound();

  const folder = await getFolder(board.folderId);
  const people = [
    ...new Set(
      board.columns.flatMap((c) =>
        c.cards.map((card) => card.assigneeId).filter(Boolean),
      ),
    ),
  ] as string[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemTopBar
        breadcrumb={folder?.name ?? ""}
        participants={people}
        shareTitle={board.name}
      />

      <div className="shrink-0 px-5 pb-4">
        <div className="flex items-center gap-2">
          <LayoutTemplateIcon
            className="size-[18px] shrink-0 text-k-black-56"
            strokeWidth={1.6}
          />
          <h1 className="min-w-0 truncate font-medium text-k-black-84 text-section">
            {board.name}
          </h1>
          <button
            type="button"
            aria-label="Favourite"
            className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <StarIcon className="size-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <BoardColumns boardId={board.id} columns={board.columns} />
    </div>
  );
}
