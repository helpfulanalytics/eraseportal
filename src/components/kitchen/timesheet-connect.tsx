"use client";

/**
 * "Connect Claude Code" — lets Tosin hand a copy-paste prompt to a Claude
 * Code session in any other codebase so it logs hours to *this* timesheet
 * as it works, without a browser session. Only ever rendered for
 * `canEditTimesheets` (see the page) — the token here is a live credential,
 * not something a client or another member should see.
 *
 * "Connected" has no heartbeat behind it — it's just whether `apiToken` has
 * ever been used in a successful POST (`apiConnectedAt`, set server-side by
 * the route itself). Reconnecting rotates the token, which is why it's a
 * confirmed action: the old one — wherever it's pasted — stops working the
 * instant the new one is issued.
 */
import { useEffect, useState, useTransition } from "react";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { regenerateTimesheetTokenAction } from "@/app/(workspace)/actions";
import { formatRelativeTime } from "@/lib/kitchen-format";
import { cn } from "@/lib/utils";

function buildPrompt(origin: string, timesheetName: string, timesheetId: string, folderId: string, token: string): string {
  return `Configure this codebase to log work to my "${timesheetName}" timesheet in the kitchen-replacement portal.

Endpoint: POST ${origin}/api/timesheet-entries
Body: {"timesheetId": "${timesheetId}", "token": "${token}", "notes": "<what was done>", "hours": <number>}

Add a short section to this repo's CLAUDE.md (create one if there isn't one) telling future sessions: after finishing a work stage here, ask me whether to log it to this timesheet, and if I say yes, POST the body above with the real notes/hours filled in. Keep the token out of anything that gets committed — reference it from an untracked file or this instruction block itself, not source.

Then send one real entry now (whatever you actually just did, or "Connected this codebase" for 0.1 hours if nothing's done yet) to confirm the connection works, and tell me the result.`;
}

export function TimesheetConnect({
  timesheetId,
  folderId,
  timesheetName,
  apiToken,
  apiConnectedAt,
}: {
  timesheetId: string;
  folderId: string;
  timesheetName: string;
  apiToken: string;
  apiConnectedAt?: string;
}) {
  const [token, setToken] = useState(apiToken);
  const [connectedAt, setConnectedAt] = useState(apiConnectedAt);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const prompt = origin ? buildPrompt(origin, timesheetName, timesheetId, folderId, token) : "";

  const copy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reconnect = () => {
    if (
      !window.confirm(
        "Reconnect this timesheet? The current code stops working immediately — any codebase still using it will need the new one.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const next = await regenerateTimesheetTokenAction(timesheetId, folderId);
        setToken(next);
        setConnectedAt(undefined);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't reconnect.");
      }
    });
  };

  return (
    <div className="mb-6 rounded-xl border border-k-black-08 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              connectedAt ? "bg-k-green-0e" : "bg-k-black-16",
            )}
          />
          <span className="font-medium text-k-black-84 text-sm">
            {connectedAt ? "Claude Code connected" : "Not connected yet"}
          </span>
          {connectedAt ? (
            <span className="text-k-black-40 text-sm">
              · last synced {formatRelativeTime(connectedAt)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={reconnect}
          disabled={pending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-k-black-12 px-2.5 py-1.5 text-k-black-56 text-sm transition-colors hover:bg-k-black-03 hover:text-k-black-84 disabled:opacity-60"
        >
          <RefreshCwIcon className="size-3.5" strokeWidth={1.8} />
          {pending ? "Reconnecting…" : connectedAt ? "Reconnect" : "Get a new code"}
        </button>
      </div>

      {error ? <p role="alert" className="mt-2 text-k-red text-sm">{error}</p> : null}

      <div className="relative mt-3">
        <pre className="max-h-48 overflow-y-auto rounded-lg bg-k-black-03 p-3 text-k-black-72 text-xs leading-relaxed whitespace-pre-wrap">
          {prompt || "Loading…"}
        </pre>
        <button
          type="button"
          onClick={copy}
          disabled={!prompt}
          className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-background px-2 py-1 text-k-black-56 text-xs shadow-xs transition-colors hover:text-k-black-84 disabled:opacity-60"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3" strokeWidth={2} /> Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-3" strokeWidth={1.8} /> Copy
            </>
          )}
        </button>
      </div>
      <p className="mt-2 text-k-black-40 text-xs">
        Paste this into Claude Code in any project you want logging hours here.
      </p>
    </div>
  );
}
