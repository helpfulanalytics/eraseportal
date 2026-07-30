import { notFound } from "next/navigation";
import { BoardColumns } from "@/components/kitchen/board-columns";
import { BoardHeader } from "@/components/kitchen/board-header";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { requireFolderAccess } from "@/lib/access-guard";
import { getBoard, getFolder } from "@/lib/kitchen-data";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; boardId: string }>;
}) {
  const { boardId } = await params;
  const board = await getBoard(boardId);
  if (!board) notFound();

  const folder = await getFolder(board.folderId);
  await requireFolderAccess(folder);
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

      <BoardHeader
        boardId={board.id}
        folderId={board.folderId}
        name={board.name}
        color={board.color}
        starred={board.starred}
      />

      <BoardColumns boardId={board.id} columns={board.columns} />
    </div>
  );
}
