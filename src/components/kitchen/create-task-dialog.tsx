"use client";

/**
 * How a client raises a task or complaint — and how a member creates one
 * directly. No separate "complaint" type: a complaint is just a task a
 * client authored, tied to one of their own folders (see `createTaskAction`).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";

export function CreateTaskDialog({
  folders,
  onClose,
}: {
  folders: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const canSubmit = Boolean(title.trim());

  const save = () => {
    if (!canSubmit || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        await createTaskAction({
          title: title.trim(),
          folderId: folderId || undefined,
          dueDate: dueDate || undefined,
        });
        onClose();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't create that task.");
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };

  return (
    <DialogShell
      title="New task"
      onClose={onClose}
      onSubmit={save}
      canSubmit={canSubmit}
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
            aria-label="Task title"
            placeholder="What needs doing?"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>

        {folders.length > 0 ? (
          <div>
            <FieldLabel optional>Folder</FieldLabel>
            <select
              value={folderId}
              disabled={pending}
              aria-label="Folder"
              onChange={(e) => setFolderId(e.target.value)}
              className={`${dialogFieldClass} bg-background`}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
    </DialogShell>
  );
}
