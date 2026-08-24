"use client";

/**
 * The "Default client access" select in a workspace's Settings.
 *
 * Was a bare `<select>` with no state, no `onChange`, and nothing bound to
 * it — choosing an option looked like a setting but discarded itself on
 * reload. Saves on change rather than on blur like `OrgNameField`: a select
 * has no intermediate typing state to wait out, so there's nothing to gain
 * from waiting for blur.
 */
import { useState, useTransition } from "react";
import { setOrganizationDefaultClientAccessAction } from "@/app/(workspace)/actions";
import type { ClientAccessLevel } from "@/lib/kitchen-types";

const OPTIONS: Array<{ value: ClientAccessLevel; label: string }> = [
  { value: "view", label: "Can view" },
  { value: "comment", label: "Can comment" },
  { value: "edit", label: "Can edit" },
];

export function DefaultClientAccessField({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: ClientAccessLevel;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (next: ClientAccessLevel) => {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await setOrganizationDefaultClientAccessAction(organizationId, next);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      } catch {
        setValue(previous);
        setError("Couldn't save that.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value}
        disabled={pending}
        aria-label="Default client access"
        onChange={(e) => save(e.target.value as ClientAccessLevel)}
        className="h-8 w-full rounded-lg border border-k-black-08 bg-background px-2.5 text-k-black-84 text-md outline-none focus:border-k-blue disabled:opacity-60"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-k-red text-sm">{error}</span>
      ) : saved ? (
        <span className="text-k-black-40 text-sm">Saved</span>
      ) : null}
    </div>
  );
}
