"use client";

/**
 * The organization name in a workspace's Settings — same save-on-blur shape
 * as `WorkspaceNameField`, bound to `renameOrganizationAction` instead.
 */
import { useState, useTransition } from "react";
import { renameOrganizationAction } from "@/app/(workspace)/actions";

export function OrgNameField({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) { setValue(initial); return; }
    if (trimmed === initial) return;

    setError(null);
    startTransition(async () => {
      try {
        await renameOrganizationAction(organizationId, trimmed);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      } catch {
        setValue(initial);
        setError("Couldn't rename the project.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        value={value}
        disabled={pending}
        aria-label="Project name"
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
