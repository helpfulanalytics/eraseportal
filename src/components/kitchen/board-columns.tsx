"use client";

/**
 * The interactive half of the board page. The page itself stays a server
 * component for the header and breadcrumb; everything that needs state
 * (drag state, dialogs, the per-card menu) lives here.
 *
 * Dragging is layered on top of, not instead of, the "Move to <column>" menu
 * item — a card still has an unambiguous, deterministic way to change column
 * without a pointer. Dragging within a column is also keyboard-operable
 * (Tab to a card, Space to lift, arrows to move, Space to drop, Escape to
 * cancel) via dnd-kit's keyboard sensor; cross-column dragging by keyboard is
 * a known dnd-kit limitation, which is exactly what the menu item covers.
 *
 * The whole card is the drag surface, matching Trello — no separate handle.
 * The nested "open detail" button still gets ordinary clicks: dnd-kit only
 * starts a drag once the pointer clears `activationConstraint.distance`, so
 * a press-and-release with no real movement passes through as a click. The
 * trade-off is explained where the drag props are wired up on `Card`.
 */
import { useRef, useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarIcon,
  MoreHorizontalIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  addBoardColumnAction,
  deleteBoardColumnAction,
  deleteCardAction,
  moveCardAction,
  renameBoardColumnAction,
} from "@/app/(workspace)/actions";
import { CardDialog } from "@/components/kitchen/card-dialog";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

function findColumnId(columns: BoardColumn[], cardId: string): string | undefined {
  return columns.find((c) => c.cards.some((card) => card.id === cardId))?.id;
}

export function BoardColumns({
  boardId,
  columns: initialColumns,
}: {
  boardId: string;
  columns: BoardColumn[];
}) {
  // Local, optimistic copy. The server's `columns` prop is the source of
  // truth after any of our own mutations resolve and revalidatePath refreshes
  // it — creating, editing or deleting a card all go through the dialog, not
  // through this component's own state, so without reconciling below, a save
  // would succeed on the server and never appear until a hard reload.
  //
  // This is React's documented pattern for resetting state when a prop
  // changes — a conditional setState call in the render body, not inside an
  // effect, so it doesn't trip the project's no-setState-in-effect rule
  // (that one is specifically about useEffect). Skipped mid-drag so an
  // unrelated revalidation can't yank a card out from under the pointer.
  const [columns, setColumns] = useState(initialColumns);
  const [reconciledColumns, setReconciledColumns] = useState(initialColumns);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [, startTransition] = useTransition();
  const dragStartSnapshot = useRef<BoardColumn[] | null>(null);

  if (initialColumns !== reconciledColumns && !activeCard) {
    setReconciledColumns(initialColumns);
    setColumns(initialColumns);
  }

  const sensors = useSensors(
    // This is what makes the whole card both clickable and draggable: below
    // 8px of pointer movement, dnd-kit never calls a drag "started", so the
    // press-and-release that opens the detail view reaches its button as an
    // ordinary click rather than being swallowed as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
    dragStartSnapshot.current = columns;
  };

  // Cross-column moves happen live, on every hover — Trello's own board does
  // this, and it's what makes dropping into an empty column possible at all
  // (there's no card there to compute a position from at drop time).
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeColumnId = findColumnId(columns, activeId);
    const overColumnId = columns.some((c) => c.id === overId)
      ? overId
      : findColumnId(columns, overId);
    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) return;

    setColumns((prev) => {
      const activeColumn = prev.find((c) => c.id === activeColumnId);
      const overColumn = prev.find((c) => c.id === overColumnId);
      if (!activeColumn || !overColumn) return prev;

      const movingCard = activeColumn.cards.find((c) => c.id === activeId);
      if (!movingCard) return prev;

      const overIndex = overColumn.cards.findIndex((c) => c.id === overId);
      const insertAt = overIndex === -1 ? overColumn.cards.length : overIndex;

      return prev.map((col) => {
        if (col.id === activeColumnId) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeId) };
        }
        if (col.id === overColumnId) {
          const cards = [...col.cards];
          cards.splice(insertAt, 0, movingCard);
          return { ...col, cards };
        }
        return col;
      });
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    const snapshot = dragStartSnapshot.current;
    dragStartSnapshot.current = null;

    if (!over) {
      if (snapshot) setColumns(snapshot);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const columnId = findColumnId(columns, activeId);
    if (!columnId) return;

    // Reorder within the landing column if dropped on another card there —
    // handleDragOver already moved it between columns; this settles its
    // final position inside whichever column it ended up in.
    let next = columns;
    const column = columns.find((c) => c.id === columnId)!;
    const oldIndex = column.cards.findIndex((c) => c.id === activeId);
    const overIndex = column.cards.findIndex((c) => c.id === overId);
    if (overIndex !== -1 && overIndex !== oldIndex) {
      next = columns.map((c) =>
        c.id === columnId
          ? { ...c, cards: arrayMove(c.cards, oldIndex, overIndex) }
          : c,
      );
      setColumns(next);
    }

    const finalColumn = next.find((c) => c.id === columnId)!;
    const finalIndex = finalColumn.cards.findIndex((c) => c.id === activeId);

    // No-op drags (picked up and dropped back where it started) shouldn't
    // cost a write.
    const startColumnId = snapshot ? findColumnId(snapshot, activeId) : columnId;
    const startIndex = snapshot
      ? snapshot.find((c) => c.id === startColumnId)?.cards.findIndex((c) => c.id === activeId)
      : oldIndex;
    if (startColumnId === columnId && startIndex === finalIndex) return;

    startTransition(async () => {
      try {
        await moveCardAction(boardId, activeId, columnId, finalIndex);
      } catch {
        if (snapshot) setColumns(snapshot);
      }
    });
  };

  const handleDragCancel = () => {
    setActiveCard(null);
    if (dragStartSnapshot.current) setColumns(dragStartSnapshot.current);
    dragStartSnapshot.current = null;
  };

  // Rename/delete are optimistic-with-revert, matching every other mutation
  // in this file. Add is not: there's no client-known id for a column that
  // doesn't exist yet, and it's a rare enough action that waiting the ~200ms
  // for the server's real id back is unnoticeable — AddColumnForm awaits this
  // directly and manages its own pending/error state, the same way
  // CardDialog's save() does.
  const renameColumn = (columnId: string, name: string) => {
    const previous = columns;
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, name } : c)),
    );
    startTransition(async () => {
      try {
        await renameBoardColumnAction(boardId, columnId, name);
      } catch {
        setColumns(previous);
      }
    });
  };

  const deleteColumn = (columnId: string) => {
    const previous = columns;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    startTransition(async () => {
      try {
        await deleteBoardColumnAction(boardId, columnId);
      } catch {
        setColumns(previous);
      }
    });
  };

  // The "Move to <column>" menu item and "Delete card" were the two
  // mutations in this file that didn't match its own stated rule (every
  // mutation here is optimistic-with-revert) — they waited on
  // `revalidatePath` to bring the change back down before anything visibly
  // changed. Same shape as `renameColumn`/`deleteColumn` above.
  const moveCardToColumn = (cardId: string, toColumnId: string) => {
    const previous = columns;
    setColumns((prev) => {
      const fromColumn = prev.find((c) => c.cards.some((c2) => c2.id === cardId));
      if (!fromColumn) return prev;
      const card = fromColumn.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      return prev.map((c) => {
        if (c.id === fromColumn.id) {
          return { ...c, cards: c.cards.filter((c2) => c2.id !== cardId) };
        }
        if (c.id === toColumnId) {
          return { ...c, cards: [...c.cards, card] };
        }
        return c;
      });
    });
    startTransition(async () => {
      try {
        await moveCardAction(boardId, cardId, toColumnId);
      } catch {
        setColumns(previous);
      }
    });
  };

  const removeCard = (cardId: string) => {
    const previous = columns;
    setColumns((prev) =>
      prev.map((c) => ({ ...c, cards: c.cards.filter((c2) => c2.id !== cardId) })),
    );
    startTransition(async () => {
      try {
        await deleteCardAction(boardId, cardId);
      } catch {
        setColumns(previous);
      }
    });
  };

  const addColumn = async (name: string) => {
    const column = await addBoardColumnAction(boardId, name);
    setColumns((prev) => [...prev, { ...column, cards: [] }]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      // The board's own horizontal scroller and each column's vertical one
      // are both scrollable ancestors of a dragged card, and dnd-kit's
      // default 20%-of-container edge zone reads as "nothing happens until
      // the pointer is basically at the edge" on a board this dense — wider
      // zones here mean a drag toward an off-screen column starts scrolling
      // well before the pointer reaches it.
      autoScroll={{ threshold: { x: 0.3, y: 0.25 } }}
    >
      <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5">
        <div className="flex h-full min-w-max gap-3">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              boardId={boardId}
              allColumns={columns}
              onAddCard={() => setDraft({ mode: "create", columnId: column.id })}
              onEditCard={(card) =>
                setDraft({ mode: "edit", columnId: column.id, card })
              }
              onRename={(name) => renameColumn(column.id, name)}
              onDelete={() => deleteColumn(column.id)}
              onMoveCard={moveCardToColumn}
              onDeleteCard={removeCard}
            />
          ))}
          <AddColumnForm onAdd={addColumn} />
        </div>

        {draft ? (
          <CardDialog
            boardId={boardId}
            columnId={draft.columnId}
            columns={columns}
            card={draft.mode === "edit" ? draft.card : undefined}
            onClose={() => setDraft(null)}
          />
        ) : null}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-72 rotate-1 rounded-lg bg-background p-3 shadow-xl">
            <CardBody card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  column,
  boardId,
  allColumns,
  onAddCard,
  onEditCard,
  onRename,
  onDelete,
  onMoveCard,
  onDeleteCard,
}: {
  column: BoardColumn;
  boardId: string;
  allColumns: BoardColumn[];
  onAddCard: () => void;
  onEditCard: (card: BoardCard) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveCard: (cardId: string, toColumnId: string) => void;
  onDeleteCard: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const cardIds = column.cards.map((c) => c.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const commit = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed) {
      setName(column.name); // an empty list name isn't a valid state to leave
      return;
    }
    if (trimmed !== column.name) onRename(trimmed);
  };

  const remove = () => {
    const warning = column.cards.length
      ? `Delete "${column.name}" and its ${column.cards.length} card${column.cards.length === 1 ? "" : "s"}? This can't be undone.`
      : `Delete "${column.name}"?`;
    if (window.confirm(warning)) onDelete();
  };

  return (
    <section
      className="flex w-72 flex-col rounded-xl bg-k-black-03-solid"
      aria-label={column.name}
    >
      <header className="group/header flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            COLUMN_TINT[column.id] ?? "bg-k-black-24",
          )}
          aria-hidden="true"
        />

        {editing ? (
          <input
            autoFocus
            value={name}
            aria-label="List name"
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setName(column.name);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-k-blue bg-background px-1 py-0.5 font-medium text-k-black-84 text-md outline-none ring-2 ring-k-blue-08"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="-mx-1 min-w-0 truncate rounded-md px-1 py-0.5 text-left font-medium text-k-black-84 text-md transition-colors hover:bg-k-black-06"
          >
            {name}
          </button>
        )}

        <span className="text-k-black-40 text-md">{column.cards.length}</span>

        <button
          type="button"
          aria-label={`Add card to ${column.name}`}
          onClick={onAddCard}
          className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-06 hover:text-k-black-84"
        >
          <PlusIcon className="size-4" strokeWidth={1.7} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="List options"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-36 opacity-0 transition-opacity hover:bg-k-black-06 hover:text-k-black-84 focus-visible:opacity-100 group-hover/header:opacity-100"
          >
            <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              Rename list
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={remove}>
              Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl px-2 pb-2 transition-colors",
            isOver && "bg-k-blue-04",
          )}
        >
          {column.cards.map((card) => (
            <li key={card.id}>
              <SortableCard
                card={card}
                columnId={column.id}
                columns={allColumns}
                onEdit={() => onEditCard(card)}
                onMove={(toColumnId) => onMoveCard(card.id, toColumnId)}
                onDelete={() => onDeleteCard(card.id)}
              />
            </li>
          ))}
          {column.cards.length === 0 ? (
            <li className="px-1 py-2 text-k-black-24 text-md">No cards yet.</li>
          ) : null}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard(props: {
  card: BoardCard;
  columnId: string;
  columns: BoardColumn[];
  onEdit: () => void;
  onMove: (toColumnId: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.card.id });

  return (
    <Card
      {...props}
      dragProps={{
        ...attributes,
        ...listeners,
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
      }}
      isDragging={isDragging}
    />
  );
}

function Card({
  card,
  columnId,
  columns,
  onEdit,
  onMove,
  onDelete,
  dragProps,
  isDragging,
}: {
  card: BoardCard;
  columnId: string;
  columns: BoardColumn[];
  onEdit: () => void;
  onMove: (toColumnId: string) => void;
  onDelete: () => void;
  /**
   * dnd-kit's `attributes` + `listeners`, spread on the whole card rather
   * than a dedicated handle — matching Trello, where the entire card picks
   * up. The nested "open detail" button and "⋯" menu still get plain clicks:
   * dnd-kit only starts a drag once the pointer has moved past
   * `activationConstraint.distance`, so a press-and-release with no real
   * movement reaches the button as an ordinary click.
   *
   * Trade-off worth naming: this makes the card a keyboard-focusable
   * `role="button"` (from dnd-kit's `attributes`) that itself contains two
   * more interactive elements — nested-interactive is an ARIA anti-pattern
   * in the strict sense. It's the same structure every dnd-kit Kanban
   * example (and Trello, and Linear) ships, and the alternative — a
   * dedicated grip handle — is what "the whole card" in the request rules
   * out.
   */
  dragProps: React.ComponentPropsWithRef<"article">;
  isDragging: boolean;
}) {
  const otherColumns = columns.filter((c) => c.id !== columnId);

  return (
    <article
      {...dragProps}
      aria-label={card.title}
      className={cn(
        "group relative cursor-grab touch-none rounded-lg bg-background p-3 shadow-[0_0_0_0.5px_var(--k-black-08)] transition-shadow active:cursor-grabbing hover:shadow-[0_0_0_0.5px_var(--k-black-16)]",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="block w-full text-left"
        aria-label={`Open "${card.title}"`}
      >
        <CardBody card={card} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Card options"
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-k-black-36 opacity-0 transition-opacity hover:bg-k-black-06 hover:text-k-black-84 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {otherColumns.length > 0 ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {otherColumns.map((col) => (
                  <DropdownMenuItem key={col.id} onClick={() => onMove(col.id)}>
                    {col.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            Delete card
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

/** The card's visual content only — shared between the real card and the
 * floating overlay that follows the pointer while dragging. */
function CardBody({ card }: { card: BoardCard }) {
  return (
    <>
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
        <p className="mt-1 line-clamp-2 pr-6 text-k-black-40 text-md">
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
    </>
  );
}

/**
 * The trailing "+ Add another list" slot at the end of the board — a ghost
 * column the same width as a real one, so it lines up rather than looking
 * like an unrelated button bolted onto the row.
 */
function AddColumnForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      await onAdd(trimmed);
      close();
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : "Couldn't add that list.");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-72 shrink-0 items-center gap-1.5 rounded-xl px-3 text-k-black-56 text-md transition-colors hover:bg-k-black-04 hover:text-k-black-84"
      >
        <PlusIcon className="size-4" strokeWidth={1.7} />
        Add another list
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 rounded-xl bg-k-black-03-solid p-2">
      <input
        autoFocus
        value={name}
        disabled={pending}
        placeholder="List name"
        aria-label="List name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") close();
        }}
        className="h-9 w-full rounded-lg border border-k-black-12 bg-background px-2.5 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60"
      />
      {error ? <p role="alert" className="mt-1 text-k-red text-sm">{error}</p> : null}
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          disabled={!name.trim() || pending}
          onClick={() => void submit()}
          className="flex h-8 items-center rounded-lg bg-k-blue px-3 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add list"}
        </button>
        <button
          type="button"
          aria-label="Cancel"
          disabled={pending}
          onClick={close}
          className="flex size-8 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-06 hover:text-k-black-84 disabled:opacity-60"
        >
          <XIcon className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
