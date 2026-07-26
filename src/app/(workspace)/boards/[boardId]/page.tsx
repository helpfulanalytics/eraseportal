import {
  CalendarIcon,
  LayoutTemplateIcon,
  PlusIcon,
  StarIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import {
  type BoardCard,
  formatShortDate,
  getBoard,
  getFolder,
} from "@/lib/kitchen-data";
import { cn } from "@/lib/utils";

/** Column accents. Blocked reads red, Done green, the rest stay neutral. */
const COLUMN_TINT: Record<string, string> = {
  col_done: "bg-k-green",
  col_progress: "bg-k-blue",
  col_blocked: "bg-k-red",
  col_todo: "bg-k-black-24",
};

const LABEL_TINT: Record<string, string> = {
  blocker: "bg-k-red-08 text-k-red-d3",
  security: "bg-k-yellow-16 text-k-black-72",
  milestone: "bg-k-blue-08 text-k-blue",
  launch: "bg-k-purple-20 text-k-black-72",
};

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const board = getBoard(boardId);
  if (!board) notFound();

  const folder = getFolder(board.folderId);
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

      <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5">
        <div className="flex h-full min-w-max gap-3">
          {board.columns.map((column) => (
            <section
              key={column.id}
              className="flex w-72 flex-col rounded-xl bg-k-black-03-solid"
              aria-label={column.name}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    COLUMN_TINT[column.id] ?? "bg-k-black-24",
                  )}
                  aria-hidden="true"
                />
                <h2 className="font-medium text-k-black-84 text-md">
                  {column.name}
                </h2>
                <span className="text-k-black-40 text-md">
                  {column.cards.length}
                </span>
                <button
                  type="button"
                  aria-label={`Add card to ${column.name}`}
                  className="ml-auto flex size-6 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-06 hover:text-k-black-84"
                >
                  <PlusIcon className="size-4" strokeWidth={1.7} />
                </button>
              </header>

              <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {column.cards.map((card) => (
                  <li key={card.id}>
                    <Card card={card} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ card }: { card: BoardCard }) {
  return (
    <article className="rounded-lg bg-background p-3 shadow-[0_0_0_0.5px_var(--k-black-08)] transition-shadow hover:shadow-[0_0_0_0.5px_var(--k-black-16)]">
      {card.labels?.length ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label}
              className={cn(
                "rounded px-1.5 py-px font-medium text-2xs",
                LABEL_TINT[label] ?? "bg-k-black-06 text-k-black-72",
              )}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <h3 className="text-k-black-84 text-md">{card.title}</h3>

      {card.description ? (
        <p className="mt-1 text-k-black-40 text-md">{card.description}</p>
      ) : null}

      {card.assigneeId || card.dueDate ? (
        <div className="mt-3 flex items-center gap-2">
          {card.assigneeId ? (
            <PersonAvatar personId={card.assigneeId} className="size-5" />
          ) : null}
          {card.dueDate ? (
            <span className="ml-auto flex items-center gap-1 text-k-black-40 text-sm">
              <CalendarIcon className="size-3" strokeWidth={1.7} />
              {formatShortDate(card.dueDate)}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

