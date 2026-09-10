"use client";

/**
 * One row of a project's Clients tab — the client-side mirror of
 * `TeamMemberRow`. Simpler than that one: no role to edit, no ownership to
 * transfer, just Active / Invited / Removed and the Remove/Restore pair.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { ResendInviteButton } from "@/components/kitchen/resend-invite-button";
import { removeClientAction, restoreClientAction } from "@/app/(workspace)/actions";
import { canRemoveClient, isActive } from "@/lib/permissions";
import type { Person } from "@/lib/kitchen-types";

export function ClientRow({ me, person }: { me: Person; person: Person }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = isActive(person);
  const canRemove = canRemoveClient(me, person);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't do that.");
      }
    });
  };

  const onRemove = () => {
    if (
      !window.confirm(
        `Remove ${person.name}? They'll be signed out and lose access. Their message history and any files they authored stay exactly as they are — this can be undone.`,
      )
    ) {
      return;
    }
    run(() => removeClientAction(person.id));
  };

  return (
    <li className="flex flex-col gap-1 border-k-black-06 border-b py-3">
      <div className="flex items-center gap-3">
        <PersonAvatar
          personId={person.id}
          className={active ? "size-8" : "size-8 opacity-40"}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-k-black-84 text-md">{person.name}</div>
          <div className="truncate text-k-black-40 text-md">{person.email}</div>
        </div>
        <ClientStatus person={person} />
      </div>

      {active && canRemove ? (
        <div className="flex items-center gap-1 pl-11">
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="rounded-lg px-2 py-0.5 text-k-black-56 text-sm transition-colors hover:bg-k-black-04 hover:text-k-red disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : null}

      {!active && canRemove ? (
        <div className="pl-11">
          <button
            type="button"
            onClick={() => run(() => restoreClientAction(person.id))}
            disabled={pending}
            className="rounded-lg px-2 py-0.5 text-k-black-56 text-sm transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-50"
          >
            Restore
          </button>
        </div>
      ) : null}

      {error ? <p className="pl-11 text-k-red text-sm">{error}</p> : null}
    </li>
  );
}

function ClientStatus({ person }: { person: Person }) {
  if (person.deactivatedAt) {
    return (
      <span className="shrink-0 rounded bg-k-black-04 px-2 py-0.5 text-k-black-40 text-sm">
        Removed
      </span>
    );
  }
  if (person.uid) {
    return (
      <span className="shrink-0 rounded bg-k-green-23 px-2 py-0.5 text-k-green-0e text-sm">
        Active
      </span>
    );
  }
  return <ResendInviteButton personId={person.id} />;
}
