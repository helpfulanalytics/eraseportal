"use client";

/**
 * Create/detail dialog for a board card — Trello's card modal, scaled to
 * what this data model actually holds: title, description, one assignee, a
 * due date, labels, comments, and attachments.
 *
 * Attachments follow the comments shape, not the form-field shape: they
 * accumulate rather than round-trip through `updateCard`'s full replace, so
 * adding one on an existing card is immediate (upload, then
 * `addCardAttachmentAction`) the same way posting a comment is. Only the
 * create-mode list is form state, because a brand-new card has no id yet for
 * `addCardAttachmentAction` to target — those uploads stage locally and go up
 * with the rest of the form on Save.
 *
 * Two different interaction models, not one form used two ways:
 *
 * - **Creating** a card is still a single form with a Save button — there's
 *   nothing to "view" yet, so a compose form is the honest shape.
 * - **Opening an existing card is read-only by default.** Title, members,
 *   due date and labels render as display chips; clicking one turns just
 *   that field into its editor and commits the instant you choose a value.
 *   Description is the one field with an explicit Edit / Save / Cancel,
 *   because free text benefits from a deliberate commit point that a select
 *   or a date picker doesn't. Move and Delete stay instant, as before.
 *
 * Every per-field edit still goes through `updateCardAction`, which does a
 * full-field replace, not a patch (see the comment on `updateCard` in
 * kitchen-data.ts). `persist()` below exists to make that safe from a
 * click-to-edit UI: it always sends the complete current field set, with
 * just the one field that changed overridden, so editing the due date can
 * never silently wipe the title or labels.
 *
 * Read vs. edit is deliberately styled differently, not just behaviourally
 * different — a display chip has no border and only tints on hover; the
 * moment it becomes an editor it gets a real input border and focus ring.
 * Trello draws that same line, and it's what keeps "click here to edit"
 * discoverable without every field looking like a form control all the time.
 *
 * Labels stay a fixed set of four, matching the four tints `LABEL_TINT` in
 * board-columns.tsx actually knows how to render.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import {
  CalendarIcon,
  DownloadIcon,
  MessageSquareIcon,
  PaperclipIcon,
  TagIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import {
  addCardAttachmentAction,
  addCardCommentAction,
  createCardAction,
  deleteCardAction,
  moveCardAction,
  removeCardAttachmentAction,
  updateCardAction,
} from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { useCurrentUser, usePeople, usePerson } from "@/components/workspace-provider";
import { uploadFile } from "@/lib/firebase/storage";
import {
  blockedUploadReason,
  formatBytes,
  formatDateTime,
  formatShortDate,
} from "@/lib/kitchen-format";
import type {
  Attachment,
  BoardCard,
  BoardCardComment,
  BoardColumn,
} from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/** A pending attachment: uploaded to Storage, not yet attached to a card. */
interface AttachmentDraft extends Attachment {
  /** 0–1 while the bytes are still going up; absent once it's landed. */
  progress?: number;
}

/** "report.pdf" → "PDF"; falls back to a mime-based guess for extensionless names. */
function labelForFile(name: string, mime: string): string {
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("video/")) return "Video";
  const extension = name.includes(".") ? name.split(".").pop() : "";
  if (extension) return extension.toUpperCase();
  if (mime.startsWith("image/")) return "Image";
  return "File";
}

const LABEL_OPTIONS = ["blocker", "security", "milestone", "launch"] as const;
const LABEL_TINT: Record<string, string> = {
  blocker: "bg-k-red-08 text-k-red-d3",
  security: "bg-k-yellow-16 text-k-black-72",
  milestone: "bg-k-blue-08 text-k-blue",
  launch: "bg-k-purple-20 text-k-black-72",
};

/** Display chip shared by Members/Due date/Labels when not being edited. */
const displayChipClass =
  "flex min-h-[34px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-md transition-colors hover:bg-k-black-04 disabled:pointer-events-none disabled:opacity-60";

type FieldEditor = "members" | "date" | "labels" | null;

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
  /** Present when viewing/editing; absent when creating a new card. */
  card?: BoardCard;
  onClose: () => void;
}) {
  const people = usePeople();
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(card?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(card?.dueDate ?? "");
  const [labels, setLabels] = useState<string[]>(card?.labels ?? []);
  // Create-mode staging only — see the file header. An existing card's
  // attachments live in `attachments` state further down, next to the
  // comments panel it mirrors.
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentUploading = attachmentDrafts.some((d) => d.progress !== undefined);
  const attachFileRef = useRef<HTMLInputElement>(null);

  // Existing-card-only interaction state. A new card has none of this — it's
  // a single form.
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [activeEditor, setActiveEditor] = useState<FieldEditor>(null);

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
  const titleEditRef = useRef<HTMLInputElement>(null);
  // Detail-mode only — an existing card's own attachment list, updated
  // optimistically the same way `CommentsPanel` handles its comments.
  const [attachments, setAttachments] = useState<Attachment[]>(card?.attachments ?? []);
  const [cardAttachmentError, setCardAttachmentError] = useState<string | null>(null);
  const cardAttachFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (card ? titleEditRef : titleRef).current?.focus();
  }, [card]);

  const busy = pending || moving || deleting;

  /**
   * Uploads to Storage and stages a draft chip — create mode only. The
   * finished `Attachment`s go up with the rest of the form on Save; nothing
   * here writes to the card, because there's no card yet to write to.
   */
  const stageAttachments = async (files: File[]) => {
    setAttachmentError(null);

    for (const file of files) {
      const reason = blockedUploadReason(file);
      if (reason) {
        setAttachmentError(reason);
        continue;
      }

      const id = crypto.randomUUID();
      setAttachmentDrafts((current) => [
        ...current,
        {
          id,
          name: file.name,
          label: labelForFile(file.name, file.type),
          bytes: file.size,
          mime: file.type || undefined,
          progress: 0,
        },
      ]);

      try {
        const result = await uploadFile(`boards/${boardId}`, file, (fraction) => {
          setAttachmentDrafts((current) =>
            current.map((d) => (d.id === id ? { ...d, progress: fraction } : d)),
          );
        });
        setAttachmentDrafts((current) =>
          current.map((d) =>
            d.id === id
              ? {
                  ...d,
                  bytes: result.bytes,
                  mime: result.mime,
                  url: result.downloadUrl,
                  progress: undefined,
                }
              : d,
          ),
        );
      } catch (cause) {
        setAttachmentDrafts((current) => current.filter((d) => d.id !== id));
        setAttachmentError(
          cause instanceof Error && cause.name === "NotSignedInError"
            ? cause.message
            : `Couldn't upload ${file.name}.`,
        );
      }
    }
  };

  /**
   * Writes one or more fields for an existing card, merging them onto the
   * currently-committed values first. Always sends the complete set —
   * `updateCard` replaces every field it's given, so sending only the one
   * that changed would clear everything else. See the file header.
   */
  const persist = (
    overrides: Partial<{
      title: string;
      description: string;
      assigneeId: string;
      dueDate: string;
      labels: string[];
    }>,
  ) => {
    if (!card) return;

    const next = {
      title: overrides.title ?? title,
      description: overrides.description ?? description,
      assigneeId: overrides.assigneeId ?? assigneeId,
      dueDate: overrides.dueDate ?? dueDate,
      labels: overrides.labels ?? labels,
    };

    if (overrides.title !== undefined) setTitle(overrides.title);
    if (overrides.description !== undefined) setDescription(overrides.description);
    if (overrides.assigneeId !== undefined) setAssigneeId(overrides.assigneeId);
    if (overrides.dueDate !== undefined) setDueDate(overrides.dueDate);
    if (overrides.labels !== undefined) setLabels(overrides.labels);
    setError(null);

    startTransition(async () => {
      try {
        await updateCardAction({
          boardId,
          cardId: card.id,
          title: next.title,
          description: next.description.trim() || undefined,
          assigneeId: next.assigneeId || undefined,
          dueDate: next.dueDate || undefined,
          labels: next.labels.length ? next.labels : undefined,
        });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't save that change.",
        );
      }
    });
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(card!.title); // a blank title isn't a valid state to leave
      return;
    }
    if (trimmed === card!.title) return;
    persist({ title: trimmed });
  };

  const commitDescription = () => {
    setEditingDescription(false);
    if (description.trim() === (card!.description ?? "")) return;
    persist({ description });
  };

  const cancelDescription = () => {
    setDescription(card!.description ?? "");
    setEditingDescription(false);
  };

  const toggleLabel = (label: string) => {
    const next = labels.includes(label)
      ? labels.filter((l) => l !== label)
      : [...labels, label];
    persist({ labels: next });
  };

  // Create-mode only — a single form with one Save at the bottom.
  const createSave = () => {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        await createCardAction({
          boardId,
          columnId,
          title: trimmed,
          description: description.trim() || undefined,
          assigneeId: assigneeId || undefined,
          dueDate: dueDate || undefined,
          labels: labels.length ? labels : undefined,
          attachments: attachmentDrafts
            .filter((d) => d.progress === undefined)
            .map(({ progress, ...rest }) => {
              void progress;
              return rest;
            }),
        });
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

  /**
   * Detail mode: upload, then attach immediately — no staging, because
   * there's already a real card to attach to. Optimistic the same way
   * `CommentsPanel.post` is: the chip appears mid-upload and rolls back if
   * either the upload or the write fails.
   */
  const attachToCard = async (files: File[]) => {
    if (!card) return;
    setCardAttachmentError(null);

    for (const file of files) {
      const reason = blockedUploadReason(file);
      if (reason) {
        setCardAttachmentError(reason);
        continue;
      }

      const attachmentId = crypto.randomUUID();
      try {
        const result = await uploadFile(`boards/${boardId}`, file);
        const attachment: Attachment = {
          id: attachmentId,
          name: file.name,
          label: labelForFile(file.name, result.mime),
          bytes: result.bytes,
          mime: result.mime,
          url: result.downloadUrl,
        };
        setAttachments((current) => [...current, attachment]);
        await addCardAttachmentAction(boardId, card.id, attachment);
      } catch (cause) {
        setAttachments((current) => current.filter((a) => a.id !== attachmentId));
        setCardAttachmentError(
          cause instanceof Error && cause.name === "NotSignedInError"
            ? cause.message
            : `Couldn't attach ${file.name}.`,
        );
      }
    }
  };

  const removeAttachment = (attachmentId: string) => {
    if (!card) return;
    const previous = attachments;
    setAttachments((current) => current.filter((a) => a.id !== attachmentId));
    void removeCardAttachmentAction(boardId, card.id, attachmentId).catch(() => {
      setAttachments(previous);
      setCardAttachmentError("Couldn't remove that attachment.");
    });
  };

  if (!card) {
    // Create mode: unchanged single-column form.
    return (
      <DialogShell
        title="New Card"
        size="lg"
        onClose={onClose}
        onSubmit={createSave}
        canSubmit={Boolean(title.trim()) && !attachmentUploading}
        pending={pending}
        error={error ?? attachmentError}
      >
        <div
          className="flex flex-col gap-5 px-6 pb-2"
          onPaste={(e) => {
            // A screenshot on the clipboard arrives as a file, not as text —
            // same check the conversation composer pastes through.
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void stageAttachments(files);
            }
          }}
        >
          <input
            ref={attachFileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void stageAttachments(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <div>
            <FieldLabel>Title</FieldLabel>
            <input
              ref={titleRef}
              value={title}
              disabled={busy}
              aria-label="Card title"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  createSave();
                }
              }}
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
                    onClick={() =>
                      setLabels((prev) =>
                        prev.includes(label)
                          ? prev.filter((l) => l !== label)
                          : [...prev, label],
                      )
                    }
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

          <div>
            <FieldLabel optional>Attachments</FieldLabel>
            <div className="flex flex-col gap-2">
              {attachmentDrafts.length ? (
                <ul className="flex flex-wrap gap-2">
                  {attachmentDrafts.map((draft) => (
                    <li key={draft.id}>
                      <AttachmentDraftChip
                        draft={draft}
                        onRemove={() =>
                          setAttachmentDrafts((current) =>
                            current.filter((d) => d.id !== draft.id),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => attachFileRef.current?.click()}
                className="flex h-8 w-fit items-center gap-1.5 rounded-lg border border-k-black-12 px-3 text-k-black-56 text-md transition-colors hover:border-k-black-24 hover:text-k-black-84 disabled:opacity-60"
              >
                <PaperclipIcon className="size-3.5" strokeWidth={1.7} />
                Add an image or file
              </button>
            </div>
          </div>
        </div>
      </DialogShell>
    );
  }

  // Detail mode: read-only display, click-to-edit per field.
  const assignee = people[assigneeId];

  return (
    <DialogShell
      title="Card"
      size="xl"
      hideSubmit
      subtitle={
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
      }
      onClose={onClose}
      onSubmit={() => {}}
      canSubmit={false}
      error={error}
      leftAction={
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-k-red text-md transition-colors hover:bg-k-red-08 disabled:opacity-40"
        >
          <TrashIcon className="size-3.5" strokeWidth={1.8} />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      }
    >
      <div className="flex items-start gap-6 px-6 pb-2">
        <div
          className="flex min-w-0 flex-[3] flex-col gap-4"
          onPaste={(e) => {
            // A screenshot on the clipboard arrives as a file, not as text —
            // same check the conversation composer pastes through. Scoped to
            // this column, not the whole dialog, so pasting into the comment
            // box on the right still pastes as text there.
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void attachToCard(files);
            }
          }}
        >
          {/* Title — click the heading, not a labelled field; it reads as
              content, not a form. */}
          {editingTitle ? (
            <input
              ref={titleEditRef}
              value={title}
              disabled={busy}
              aria-label="Card title"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                }
                if (e.key === "Escape") {
                  setTitle(card.title);
                  setEditingTitle(false);
                }
              }}
              className={cn(dialogFieldClass, "font-semibold text-section")}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              disabled={busy}
              className="-mx-2 rounded-lg px-2 py-1 text-left font-semibold text-k-black-84 text-section transition-colors hover:bg-k-black-04 disabled:opacity-60"
            >
              {title}
            </button>
          )}

          {/* Members / Due date — side by side display chips, each its own
              inline editor. */}
          <div className="flex flex-wrap gap-2">
            <div>
              <FieldLabel optional>Members</FieldLabel>
              {activeEditor === "members" ? (
                <select
                  autoFocus
                  value={assigneeId}
                  disabled={busy}
                  aria-label="Assignee"
                  onChange={(e) => {
                    persist({ assigneeId: e.target.value });
                    setActiveEditor(null);
                  }}
                  onBlur={() => setActiveEditor(null)}
                  className={cn(dialogFieldClass, "bg-background")}
                >
                  <option value="">Unassigned</option>
                  {Object.values(people).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setActiveEditor("members")}
                  className={displayChipClass}
                >
                  {assignee ? (
                    <>
                      <PersonAvatar personId={assignee.id} className="size-5" />
                      <span className="text-k-black-84">{assignee.name}</span>
                    </>
                  ) : (
                    <>
                      <UserIcon className="size-4 text-k-black-40" strokeWidth={1.7} />
                      <span className="text-k-black-40">Add member</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div>
              <FieldLabel optional>Due date</FieldLabel>
              {activeEditor === "date" ? (
                <input
                  autoFocus
                  type="date"
                  value={dueDate}
                  disabled={busy}
                  aria-label="Due date"
                  onChange={(e) => {
                    persist({ dueDate: e.target.value });
                    setActiveEditor(null);
                  }}
                  onBlur={() => setActiveEditor(null)}
                  className={dialogFieldClass}
                />
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setActiveEditor("date")}
                  className={displayChipClass}
                >
                  {dueDate ? (
                    <>
                      <CalendarIcon className="size-4 text-k-black-56" strokeWidth={1.7} />
                      <span className="text-k-black-84">
                        {formatShortDate(dueDate)}
                      </span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="size-4 text-k-black-40" strokeWidth={1.7} />
                      <span className="text-k-black-40">Add due date</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Labels — the editor stays open across multiple toggles; "Done"
              closes it, since a blur-per-chip-click would be jumpy. */}
          <div>
            <FieldLabel optional>Labels</FieldLabel>
            {activeEditor === "labels" ? (
              <div className="flex flex-wrap items-center gap-1.5">
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
                <button
                  type="button"
                  onClick={() => setActiveEditor(null)}
                  className="rounded-lg px-2 py-1 text-k-blue text-sm hover:bg-k-blue-08"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setActiveEditor("labels")}
                className={displayChipClass}
              >
                {labels.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {labels.map((label) => (
                      <span
                        key={label}
                        className={cn(
                          "rounded px-1.5 py-0.5 font-medium text-2xs capitalize",
                          LABEL_TINT[label] ?? "bg-k-black-06 text-k-black-72",
                        )}
                      >
                        {label}
                      </span>
                    ))}
                  </span>
                ) : (
                  <>
                    <TagIcon className="size-4 text-k-black-40" strokeWidth={1.7} />
                    <span className="text-k-black-40">Add labels</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Description — the one field with an explicit commit point. */}
          <div>
            <div className="flex items-center justify-between">
              <FieldLabel optional>Description</FieldLabel>
              {!editingDescription ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingDescription(true)}
                  className="mb-1.5 rounded-md px-2 py-0.5 text-k-black-56 text-sm transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-60"
                >
                  Edit
                </button>
              ) : null}
            </div>

            {editingDescription ? (
              <>
                <textarea
                  autoFocus
                  value={description}
                  disabled={busy}
                  rows={5}
                  placeholder="Add a more detailed description…"
                  aria-label="Card description"
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelDescription();
                  }}
                  className={cn(dialogFieldClass, "h-auto resize-none py-2")}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={commitDescription}
                    className="flex h-7 items-center rounded-lg bg-k-blue px-3 font-medium text-k-white text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={cancelDescription}
                    className="flex h-7 items-center rounded-lg px-3 text-k-black-56 text-sm hover:bg-k-black-04"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : description ? (
              <p className="whitespace-pre-wrap px-2 py-1 text-k-black-72 text-md">
                {description}
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditingDescription(true)}
                className="-mx-2 w-full rounded-lg px-2 py-1.5 text-left text-k-black-40 text-md transition-colors hover:bg-k-black-04 disabled:opacity-60"
              >
                Add a more detailed description…
              </button>
            )}
          </div>

          <div>
            <input
              ref={cardAttachFileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void attachToCard(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <FieldLabel optional>Attachments</FieldLabel>
            <div className="flex flex-col gap-2">
              {attachments.length ? (
                <ul className="flex flex-col gap-1.5">
                  {attachments.map((attachment) => (
                    <AttachmentRow
                      key={attachment.id}
                      attachment={attachment}
                      disabled={busy}
                      onRemove={() => removeAttachment(attachment.id)}
                    />
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => cardAttachFileRef.current?.click()}
                className="flex h-8 w-fit items-center gap-1.5 rounded-lg border border-k-black-12 px-3 text-k-black-56 text-md transition-colors hover:border-k-black-24 hover:text-k-black-84 disabled:opacity-60"
              >
                <PaperclipIcon className="size-3.5" strokeWidth={1.7} />
                Add an image or file
              </button>
              {cardAttachmentError ? (
                <p role="alert" className="text-k-red text-sm">
                  {cardAttachmentError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-[2] flex-col border-k-black-06 border-l pl-6">
          <CommentsPanel boardId={boardId} card={card} disabled={busy} />
        </div>
      </div>
    </DialogShell>
  );
}

/**
 * The right-hand pane on an existing card: a write box plus the feed below
 * it, newest first. The feed is real comments plus one synthetic entry at
 * the very end — "X added this card" — built from `card.authorId`/
 * `createdAt` rather than a logged event, since those are the only two
 * pieces of card history this data model actually tracks. Cards created
 * before that was tracked have neither and simply show no such line, rather
 * than a fabricated one.
 */
function CommentsPanel({
  boardId,
  card,
  disabled,
}: {
  boardId: string;
  card: BoardCard;
  disabled: boolean;
}) {
  const me = useCurrentUser();
  const author = usePerson(card.authorId);
  const [comments, setComments] = useState<BoardCardComment[]>(card.comments ?? []);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const post = () => {
    const text = draft.trim();
    if (!text || pending || !me) return;
    setError(null);

    // Optimistic: a temp id good enough to key the list until the real one
    // comes back. There's nothing to reconcile it against — comments aren't
    // edited or deleted anywhere in this UI, so a mismatched temp id never
    // has consequences.
    const optimistic: BoardCardComment = {
      id: `pending-${Date.now()}`,
      authorId: me.id,
      text,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setDraft("");

    startTransition(async () => {
      try {
        await addCardCommentAction(boardId, card.id, text);
      } catch {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        setDraft(text);
        setError("Couldn't post that comment.");
      }
    });
  };

  const feed = [...comments].reverse();
  const hasActivity = feed.length > 0 || Boolean(card.authorId && card.createdAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-k-black-06 border-b pb-3">
        <MessageSquareIcon className="size-4 text-k-black-56" strokeWidth={1.8} />
        <h3 className="font-medium text-k-black-84 text-md">
          Comments and activity
        </h3>
      </div>

      {/* One bordered composer, not loose parts — the textarea and its
          Comment button read as a single control, with a focus ring that
          picks up the moment the textarea is active. */}
      <div className="mt-3 flex items-start gap-2">
        <PersonAvatar personId={me?.id ?? ""} className="mt-0.5 size-7 shrink-0" />
        <div className="min-w-0 flex-1 rounded-xl border border-k-black-12 bg-background p-2 transition-colors focus-within:border-k-blue focus-within:ring-1 focus-within:ring-k-blue-08">
          <textarea
            value={draft}
            disabled={disabled || pending}
            rows={2}
            placeholder="Write a comment…"
            aria-label="Write a comment"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                post();
              }
            }}
            className="h-auto w-full resize-none border-none bg-transparent p-1 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-k-black-24 text-xs">⌘ + Enter to post</span>
            <button
              type="button"
              disabled={!draft.trim() || disabled || pending}
              onClick={post}
              className="flex h-7 items-center rounded-lg bg-k-blue px-3 font-medium text-k-white text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 ml-9 text-k-red text-sm">
          {error}
        </p>
      ) : null}

      {hasActivity ? (
        <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {feed.map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))}

          {card.authorId && card.createdAt ? (
            <li className="flex items-start gap-2 text-sm">
              <PersonAvatar personId={card.authorId} className="mt-0.5 size-7 shrink-0" />
              <div className="min-w-0">
                <p className="text-k-black-72">
                  <span className="font-medium text-k-black-84">
                    {author?.name ?? "Someone"}
                  </span>{" "}
                  added this card
                </p>
                <p className="mt-0.5 text-k-black-36 text-xs">
                  {formatDateTime(card.createdAt)}
                </p>
              </div>
            </li>
          ) : null}
        </ul>
      ) : (
        // Without this, an old card (no authorId/createdAt) with zero
        // comments renders nothing at all below the composer — reads as
        // broken rather than simply empty.
        <p className="mt-6 text-center text-k-black-24 text-sm">
          No activity yet.
        </p>
      )}
    </div>
  );
}

function CommentRow({ comment }: { comment: BoardCardComment }) {
  const author = usePerson(comment.authorId);
  return (
    <li className="flex items-start gap-2 text-sm">
      <PersonAvatar personId={comment.authorId} className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-medium text-k-black-84">
            {author?.name ?? "Someone"}
          </span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-k-black-72">
          {comment.text}
        </p>
        <p className="mt-0.5 text-k-black-36 text-xs">
          {formatDateTime(comment.createdAt)}
        </p>
      </div>
    </li>
  );
}

/** Create-mode staged attachment — matches `Composer`'s `DraftChip`. */
function AttachmentDraftChip({
  draft,
  onRemove,
}: {
  draft: AttachmentDraft;
  onRemove: () => void;
}) {
  const busy = draft.progress !== undefined;

  return (
    <span className="flex items-center gap-2 rounded-lg border border-k-black-08 bg-background py-1 pr-1 pl-2.5">
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate text-k-black-84 text-sm">
          {draft.name}
        </span>
        <span className="block text-k-black-40 text-xs">
          {busy
            ? `Uploading ${Math.round((draft.progress ?? 0) * 100)}%`
            : draft.bytes > 0
              ? `${draft.label} • ${formatBytes(draft.bytes)}`
              : draft.label}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${draft.name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
      >
        <XIcon className="size-3.5" strokeWidth={1.8} />
      </button>
    </span>
  );
}

/**
 * An existing card's attachment — a real link when Storage gave it a URL,
 * a chip you can only read otherwise. Same caveat `Attachment.url`'s own
 * doc comment carries: seeded fixtures have no bytes behind them.
 */
function AttachmentRow({
  attachment,
  disabled,
  onRemove,
}: {
  attachment: Attachment;
  disabled: boolean;
  onRemove: () => void;
}) {
  const meta = attachment.bytes > 0
    ? `${attachment.label} • ${formatBytes(attachment.bytes)}`
    : attachment.label;

  return (
    <li className="flex items-center gap-2 rounded-lg border border-k-black-08 bg-background py-1.5 pr-1.5 pl-2.5">
      {attachment.url ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
        >
          <DownloadIcon className="size-3.5 shrink-0 text-k-black-40" strokeWidth={1.7} />
          <span className="min-w-0">
            <span className="block truncate text-k-black-84 text-sm">
              {attachment.name}
            </span>
            <span className="block text-k-black-40 text-xs">{meta}</span>
          </span>
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <PaperclipIcon className="size-3.5 shrink-0 text-k-black-40" strokeWidth={1.7} />
          <span className="min-w-0">
            <span className="block truncate text-k-black-84 text-sm">
              {attachment.name}
            </span>
            <span className="block text-k-black-40 text-xs">{meta}</span>
          </span>
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${attachment.name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-60"
      >
        <XIcon className="size-3.5" strokeWidth={1.8} />
      </button>
    </li>
  );
}
