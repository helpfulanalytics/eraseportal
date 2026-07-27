"use client";

/**
 * The workspace name in Settings.
 *
 * Saves on blur and on Enter rather than behind a Save button — it's one
 * field, and the surrounding form has no submit affordance to hang a button
 * off. A short confirmation appears instead, so the save isn't silent.
 */
import { useState, useTransition } from "react";
import { renameWorkspaceAction } from "@/app/(workspace)/actions";

export function WorkspaceNameField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const trimmed = value.trim();
    // Nothing to do if it's unchanged, and an empty name would leave the
    // sidebar blank — put the previous one back instead.
    if (!trimmed) { setValue(initial); return; }
    if (trimmed === initial) return;

    setError(null);
    startTransition(async () => {
      try {
        await renameWorkspaceAction(trimmed);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      } catch {
        setValue(initial);
        setError("Couldn't rename the workspace.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        value={value}
        disabled={pending}
        aria-label="Workspace name"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { setValue(initial); e.currentTarget.blur(); }
        }}
        className="h-8 w-full rounded-lg border border-k-black-08 px-3 text-k-black-84 text-md outline-none focus:border-k-blue disabled:opacity-60"
      />
      {error ? (
        <span role="alert" className="text-k-red text-sm">{error}</span>
      ) : saved ? (
        <span className="text-k-black-40 text-sm">Saved</span>
      ) : null}
    </div>
  );
}
