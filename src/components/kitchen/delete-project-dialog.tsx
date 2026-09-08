"use client";

/**
 * Confirms a project's cascading delete — the project and everything inside
 * it (folders, boards, conversations, documents, embeds, files, clients),
 * no "empty it first" required, no going back. Typing the project's exact
 * name is the guard: `canSubmit` only turns true on an exact match, and
 * `deleteOrganizationCascadeAction` re-checks the same match server-side
 * rather than trusting this dialog.
 */
import { useState } from "react";
import { DialogShell, dialogFieldClass, FieldLabel } from "@/components/kitchen/dialog-shell";

export function DeleteProjectDialog({
  projectName,
  onConfirm,
  onClose,
}: {
  projectName: string;
  /** Throw to show the error inline — same contract as every other dialog here. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmText.trim() === projectName && !pending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't delete the project.");
      setPending(false);
    }
  };

  return (
    <DialogShell
      title="Delete project"
      subtitle={`This permanently deletes every folder, board, conversation, document, file, and client inside "${projectName}". This can't be undone.`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Delete project"
      pending={pending}
      canSubmit={canSubmit}
      error={error}
      destructive
    >
      <div className="px-6 py-5">
        <FieldLabel>
          Type <span className="font-semibold text-k-black-84">{projectName}</span> to confirm
        </FieldLabel>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={projectName}
          disabled={pending}
          className={dialogFieldClass}
        />
      </div>
    </DialogShell>
  );
}
