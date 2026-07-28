"use client";

/**
 * Create/edit dialog for a board card. One component for both — editing is
 * creating with the fields pre-filled and a different action underneath.
 *
 * Labels are a fixed set of four rather than free text, matching the four
 * tints `LABEL_TINT` in the board page actually knows how to render. A custom
 * label would fall back to a plain grey chip, which is a fine default but not
 * worth the extra input for a first pass — add free text here if that grey
 * chip ever needs a name.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { createCardAction, updateCardAction } from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";
import { usePeople } from "@/components/workspace-provider";
import type { BoardCard } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const LABEL_OPTIONS = ["blocker", "security", "milestone", "launch"] as const;

type CardDraft = {
  boardId: string;
  columnId: string;
  /** Present when editing; absent when creating a new card. */
  card?: BoardCard;
  onClose: () => void;
};

export function CardDialog({ boardId, columnId, card, onClose }: CardDraft) {
  const people = usePeople();
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(card?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(card?.dueDate ?? "");
  const [labels, setLabels] = useState<string[]>(card?.labels ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };

  return (
    <DialogShell
      title={card ? "Edit Card" : "New Card"}
      onClose={onClose}
      onSubmit={save}
      canSubmit={Boolean(title.trim())}
      pending={pending}
      error={error}
    >
      <div className="flex flex-col gap-4 px-6">
        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            ref={titleRef}
            value={title}
            disabled={pending}
            aria-label="Card title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>

        <div>
          <FieldLabel optional>Description</FieldLabel>
          <textarea
            value={description}
            disabled={pending}
            rows={2}
            aria-label="Card description"
            onChange={(e) => setDescription(e.target.value)}
            className={cn(dialogFieldClass, "h-auto resize-none py-2")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel optional>Assignee</FieldLabel>
            <select
              value={assigneeId}
              disabled={pending}
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
              disabled={pending}
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
                  disabled={pending}
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
      </div>
    </DialogShell>
  );
}
