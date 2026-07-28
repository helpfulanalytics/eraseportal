"use client";

/**
 * Create/detail dialog for a board card — Trello's card modal, scaled to
 * what this data model actually holds: title, description, one assignee, a
 * due date, and labels. There's no comment thread or attachments here
 * because there's no data behind either; this doesn't pretend otherwise.
 *
 * One component for both create and the full detail view — editing is
 * creating with the fields pre-filled and a different action underneath.
 * Create still gets the whole layout (bigger than a bare "name it" form),
 * because there's nothing about the fields that should differ by mode.
 *
 * Move and Delete are instant, not gated behind Save — pick a different list
 * from the dropdown and it fires immediately, matching Trello, where you'd
 * never want a list change silently reverted because you closed without
 * saving. Save covers only the fields you'd expect a Cancel to discard:
 * title, description, assignee, due date, labels.
 *
 * Labels are a fixed set of four rather than free text, matching the four
 * tints `LABEL_TINT` in board-columns.tsx actually knows how to render. A
 * custom label would fall back to a plain grey chip, which is a fine default
 * but not worth the extra input for a first pass — add free text here if
 * that grey chip ever needs a name.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { TrashIcon } from "lucide-react";
import {
  createCardAction,
  deleteCardAction,
  moveCardAction,
  updateCardAction,
} from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";
import { usePeople } from "@/components/workspace-provider";
import type { BoardCard, BoardColumn } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const LABEL_OPTIONS = ["blocker", "security", "milestone", "launch"] as const;

export function CardDialog({
  boardId,
  columnId,
  columns,
  card,
  onClose,
}: {
  boardId: string;
  columnId: string;
  /** For the "in list" switcher and resolving the current column's name. */
  columns: BoardColumn[];
  /** Present when editing/viewing; absent when creating a new card. */
  card?: BoardCard;
  onClose: () => void;
}) {
  const people = usePeople();
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(card?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(card?.dueDate ?? "");
  const [labels, setLabels] = useState<string[]>(card?.labels ?? []);
  // Own state rather than reading `columnId` straight from props: after a
  // move, the parent's `draft.columnId` doesn't update (the dialog was
  // opened with the *original* column), so the "in list" select would
  // otherwise snap back to it the instant React re-renders with the old
  // controlled value.
  const [currentColumnId, setCurrentColumnId] = useState(columnId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [moving, startMove] = useTransition();
  const [deleting, startDelete] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const toggleLabel = (label: string) =>
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    setError(null);

    const fields = {
      title: trimmed,
      description: description.trim() || undefined,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
      labels: labels.length ? labels : undefined,
    };

    startTransition(async () => {
      try {
        if (card) {
          await updateCardAction({ boardId, cardId: card.id, ...fields });
        } else {
          await createCardAction({ boardId, columnId, ...fields });
        }
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't save that card.",
        );
      }
    });
  };

  const move = (toColumnId: string) => {
    if (!card || toColumnId === currentColumnId) return;
    const previous = currentColumnId;
    setCurrentColumnId(toColumnId);

    startMove(async () => {
      try {
        await moveCardAction(boardId, card.id, toColumnId);
      } catch {
        setCurrentColumnId(previous);
      }
    });
  };

  const remove = () => {
    if (!card) return;
    startDelete(async () => {
      await deleteCardAction(boardId, card.id);
      onClose();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };

  const busy = pending || moving || deleting;

  return (
    <DialogShell
      title={card ? "Card" : "New Card"}
      size="lg"
      subtitle={
        card ? (
          <span className="flex items-center gap-1.5">
            in list
            <select
              value={currentColumnId}
              disabled={busy}
              aria-label="Move to list"
              onChange={(e) => move(e.target.value)}
              className="rounded border-none bg-k-black-04 px-1.5 py-0.5 text-k-black-72 text-sm outline-none focus:ring-1 focus:ring-k-blue disabled:opacity-60"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </span>
        ) : undefined
      }
      onClose={onClose}
      onSubmit={save}
      canSubmit={Boolean(title.trim())}
      pending={pending}
      error={error}
      leftAction={
        card ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-k-red text-md transition-colors hover:bg-k-red-08 disabled:opacity-40"
          >
            <TrashIcon className="size-3.5" strokeWidth={1.8} />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-5 px-6 pb-2">
        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            ref={titleRef}
            value={title}
            disabled={busy}
            aria-label="Card title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKeyDown}
            className={cn(dialogFieldClass, "text-md font-medium")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel optional>Members</FieldLabel>
            <select
              value={assigneeId}
              disabled={busy}
              aria-label="Assignee"
              onChange={(e) => setAssigneeId(e.target.value)}
              className={cn(dialogFieldClass, "bg-background")}
            >
              <option value="">Unassigned</option>
              {Object.values(people).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel optional>Due date</FieldLabel>
            <input
              type="date"
              value={dueDate}
              disabled={busy}
              aria-label="Due date"
              onChange={(e) => setDueDate(e.target.value)}
              className={dialogFieldClass}
            />
          </div>
        </div>

        <div>
          <FieldLabel optional>Labels</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {LABEL_OPTIONS.map((label) => {
              const active = labels.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  aria-pressed={active}
                  onClick={() => toggleLabel(label)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-md capitalize transition-colors",
                    active
                      ? "border-k-blue bg-k-blue-08 text-k-blue"
                      : "border-k-black-12 text-k-black-56 hover:border-k-black-24",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel optional>Description</FieldLabel>
          <textarea
            value={description}
            disabled={busy}
            rows={5}
            placeholder="Add a more detailed description…"
            aria-label="Card description"
            onChange={(e) => setDescription(e.target.value)}
            className={cn(dialogFieldClass, "h-auto resize-none py-2")}
          />
        </div>
      </div>
    </DialogShell>
  );
}
