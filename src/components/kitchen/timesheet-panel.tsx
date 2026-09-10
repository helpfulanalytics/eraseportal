"use client";

/**
 * The dashboard's quick work-log form — log an entry as you finish a piece
 * of work, without leaving the app. Runs alongside the external
 * time-tracking sheet (see `logTimeAction`), not in place of it: this is
 * just a fast, always-visible way to jot down what you did and how long it
 * took, member-only.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logTimeAction } from "@/app/(workspace)/actions";
import { dialogFieldClass, FieldLabel } from "@/components/kitchen/dialog-shell";
import { formatRelativeTime } from "@/lib/kitchen-format";
import type { TimesheetEntry } from "@/lib/kitchen-types";

export function TimesheetPanel({
  organizations,
  entries,
}: {
  organizations: Array<{ id: string; name: string }>;
  entries: TimesheetEntry[];
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const orgById = new Map(organizations.map((o) => [o.id, o.name]));
  const today = new Date().toISOString().slice(0, 10);
  const todayHours = entries
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.hours, 0);

  const canSubmit = Boolean(notes.trim()) && Number(hours) > 0;

  const log = () => {
    if (!canSubmit || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        await logTimeAction({
          organizationId: organizationId || undefined,
          notes: notes.trim(),
          hours: Number(hours),
        });
        setNotes("");
        setHours("");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't log that.");
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      log();
    }
  };

  return (
    <div className="rounded-xl border border-k-black-08 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-k-black-84 text-md">Log time</h2>
        {todayHours > 0 ? (
          <span className="text-k-black-40 text-sm">
            {todayHours} hr{todayHours === 1 ? "" : "s"} logged today
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <FieldLabel optional>Project</FieldLabel>
          <select
            value={organizationId}
            disabled={pending}
            aria-label="Project"
            onChange={(e) => setOrganizationId(e.target.value)}
            className={`${dialogFieldClass} bg-background`}
          >
            <option value="">General / internal</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-24">
          <FieldLabel>Hours</FieldLabel>
          <input
            type="number"
            step="0.25"
            min="0"
            value={hours}
            disabled={pending}
            aria-label="Hours"
            placeholder="0.5"
            onChange={(e) => setHours(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>

        <div className="flex-1">
          <FieldLabel>What did you do</FieldLabel>
          <input
            value={notes}
            disabled={pending}
            aria-label="What did you do"
            placeholder="Fixed the notification badge…"
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>

        <button
          type="button"
          onClick={log}
          disabled={!canSubmit || pending}
          className="h-9 shrink-0 rounded-lg bg-k-blue px-4 text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Logging…" : "Log"}
        </button>
      </div>

      {error ? <p className="mt-2 text-k-red text-sm">{error}</p> : null}

      {entries.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 border-k-black-06 border-t pt-4">
          {entries.slice(0, 6).map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 text-sm"
            >
              <span className="w-14 shrink-0 text-k-black-40">
                {entry.hours} hr{entry.hours === 1 ? "" : "s"}
              </span>
              <span className="flex-1 truncate text-k-black-84">{entry.notes}</span>
              {entry.organizationId ? (
                <span className="shrink-0 text-k-black-40">
                  {orgById.get(entry.organizationId) ?? "—"}
                </span>
              ) : null}
              <span className="shrink-0 text-k-black-24">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
