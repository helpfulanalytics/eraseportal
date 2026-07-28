"use client";

/**
 * The interactive half of the board page. The page itself stays a server
 * component for the header and breadcrumb; everything that needs state
 * (dialogs, the per-card menu) lives here.
 *
 * No drag and drop. Moving a card is a menu action — "Move to <column>" —
 * rather than a pointer gesture, which is both less code and something a
 * screen reader user can actually do. Add drag and drop as a progressive
 * enhancement over this if the columns ever feel like they need it; the menu
 * should stay regardless.
 */
import { useState, useTransition } from "react";
import { CalendarIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { deleteCardAction, moveCardAction } from "@/app/(workspace)/actions";
import { CardDialog } from "@/components/kitchen/card-dialog";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatShortDate } from "@/lib/kitchen-format";
import type { BoardCard, BoardColumn } from "@/lib/kitchen-types";
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

type Draft =
  | { mode: "create"; columnId: string }
  | { mode: "edit"; columnId: string; card: BoardCard };

export function BoardColumns({
  boardId,
  columns,
}: {
  boardId: string;
  columns: BoardColumn[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5">
      <div className="flex h-full min-w-max gap-3">
        {columns.map((column) => (
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
                onClick={() => setDraft({ mode: "create", columnId: column.id })}
                className="ml-auto flex size-6 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-06 hover:text-k-black-84"
              >
                <PlusIcon className="size-4" strokeWidth={1.7} />
              </button>
            </header>

            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {column.cards.map((card) => (
                <li key={card.id}>
                  <Card
                    card={card}
                    boardId={boardId}
                    columnId={column.id}
                    columns={columns}
                    onEdit={() => setDraft({ mode: "edit", columnId: column.id, card })}
                  />
                </li>
              ))}
              {column.cards.length === 0 ? (
                <li className="px-1 py-2 text-k-black-24 text-md">No cards yet.</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      {draft ? (
        <CardDialog
          boardId={boardId}
          columnId={draft.columnId}
          card={draft.mode === "edit" ? draft.card : undefined}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}

function Card({
  card,
  boardId,
  columnId,
  columns,
  onEdit,
}: {
  card: BoardCard;
  boardId: string;
  columnId: string;
  columns: BoardColumn[];
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const otherColumns = columns.filter((c) => c.id !== columnId);

  const move = (toColumnId: string) => {
    startTransition(() => moveCardAction(boardId, card.id, toColumnId));
  };

  const remove = () => {
    startTransition(() => deleteCardAction(boardId, card.id));
  };

  return (
    <article
      className={cn(
        "group relative rounded-lg bg-background p-3 shadow-[0_0_0_0.5px_var(--k-black-08)] transition-shadow hover:shadow-[0_0_0_0.5px_var(--k-black-16)]",
        pending && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        disabled={pending}
        className="block w-full text-left"
        aria-label={`Edit "${card.title}"`}
      >
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

        <h3 className="pr-6 text-k-black-84 text-md">{card.title}</h3>

        {card.description ? (
          <p className="mt-1 pr-6 text-k-black-40 text-md">
            {card.description}
          </p>
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
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Card options"
          disabled={pending}
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-k-black-36 opacity-0 transition-opacity hover:bg-k-black-06 hover:text-k-black-84 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {otherColumns.length > 0 ? (
            <>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {otherColumns.map((col) => (
                <DropdownMenuItem key={col.id} onClick={() => move(col.id)}>
                  {col.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={remove}>
            Delete card
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}
