"use client";

/**
 * A timesheet's body: a quick-log form (member-only — clients get a
 * read-only view, same principle as the composer's "internal note" toggle
 * being member-only elsewhere) and the entry list below it, grouped by day.
 *
 * Fully client-visible by design — see the doc comment on `Timesheet` in
 * kitchen-types.ts. There's no notes-redaction here on purpose.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logTimesheetEntryAction } from "@/app/(workspace)/actions";
import { dialogFieldClass, FieldLabel } from "@/components/kitchen/dialog-shell";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { usePerson } from "@/components/workspace-provider";
import { formatShortDate } from "@/lib/kitchen-format";
import type { TimesheetEntry } from "@/lib/kitchen-types";

function EntryAuthor({ personId }: { personId: string }) {
  const person = usePerson(personId);
  return (
    <div className="flex items-center gap-1.5">
      <PersonAvatar personId={personId} className="size-5" />
      <span className="text-k-black-56 text-sm">{person?.name ?? "Someone"}</span>
    </div>
  );
}

function groupByDate(entries: TimesheetEntry[]): Array<[string, TimesheetEntry[]]> {
  const groups = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.date) ?? [];
    list.push(entry);
    groups.set(entry.date, list);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export function TimesheetEntries({
  timesheetId,
  folderId,
  entries,
  canLog,
}: {
  timesheetId: string;
  folderId: string;
  entries: TimesheetEntry[];
  /** False for a client — they see the ledger, not the form. */
  canLog: boolean;
}) {
  const router = useRouter();
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = Boolean(notes.trim()) && Number(hours) > 0;

  const log = () => {
    if (!canSubmit || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        await logTimesheetEntryAction({
          timesheetId,
          folderId,
          notes: notes.trim(),
          hours: Number(hours),
        });
        setHours("");
        setNotes("");
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

  const groups = groupByDate(entries);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8">
      {canLog ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-k-black-08 p-4 sm:flex-row sm:items-end">
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
      ) : null}

      {error ? <p role="alert" className="mb-4 text-k-red text-sm">{error}</p> : null}

      {groups.length === 0 ? (
        <p className="py-12 text-center text-k-black-40 text-md">
          {canLog ? "No hours logged yet — the first entry starts the ledger." : "No hours logged yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0);
            return (
              <div key={date}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-medium text-k-black-56 text-sm">
                    {formatShortDate(`${date}T00:00:00Z`)}
                  </h3>
                  <span className="text-k-black-40 text-sm tabular-nums">
                    {dayTotal} hr{dayTotal === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {dayEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg border border-k-black-06 px-3 py-2.5"
                    >
                      <span className="w-14 shrink-0 font-medium text-k-black-84 text-sm tabular-nums">
                        {entry.hours} hr{entry.hours === 1 ? "" : "s"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-k-black-84 text-md">
                        {entry.notes}
                      </span>
                      <EntryAuthor personId={entry.authorId} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
