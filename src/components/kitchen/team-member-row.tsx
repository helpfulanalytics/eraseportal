"use client";

/**
 * One row of the Team page: who they are, what tier they hold, and what the
 * viewer is allowed to do about it.
 *
 * Every control here is gated by the same predicate the server action
 * re-checks — `canAssignRole`, `canRemoveMember`, `canTransferOwnership` from
 * `permissions.ts`, which is pure precisely so both sides can share it. The
 * UI decides what to *offer*; `team-actions.ts` decides what to *allow*. A
 * disabled select is a courtesy, never the boundary.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { ResendMemberInviteButton } from "@/components/kitchen/resend-member-invite-button";
import {
  removeMemberAction,
  restoreMemberAction,
  transferOwnershipAction,
  updateMemberRoleAction,
} from "@/app/(workspace)/team-actions";
import {
  canAssignRole,
  canRemoveMember,
  canTransferOwnership,
  isActive,
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  memberRoleOf,
} from "@/lib/permissions";
import type { MemberRole, Person } from "@/lib/kitchen-types";

export function TeamMemberRow({ me, person }: { me: Person; person: Person }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const role = memberRoleOf(person) ?? "member";
  const active = isActive(person);
  const isSelf = me.id === person.id;

  // `owner` is in the list only for the person who already holds it —
  // promoting someone to owner is a transfer, not a role edit, because the
  // seat has to leave the current holder in the same write.
  const assignable = MEMBER_ROLES.filter(
    (r) => r !== "owner" && canAssignRole(me, person, r),
  );
  const canEditRole = active && assignable.length > 0;
  const showTransfer = active && canTransferOwnership(me, person) && !!person.uid;
  const showRemove = canRemoveMember(me, person) && active;

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

  const onRoleChange = (next: string) => {
    if (next === role) return;
    run(() => updateMemberRoleAction(person.id, next as MemberRole));
  };

  const onRemove = () => {
    if (
      !window.confirm(
        `Remove ${person.name}? They'll be signed out and lose access, but their name stays on the work they did.`,
      )
    ) {
      return;
    }
    run(() => removeMemberAction(person.id));
  };

  const onTransfer = () => {
    if (
      !window.confirm(
        `Make ${person.name} the owner? You'll become an admin, and only they can undo this.`,
      )
    ) {
      return;
    }
    run(() => transferOwnershipAction(person.id));
  };

  return (
    <li className="flex flex-col gap-1 border-k-black-06 border-b py-3">
      <div className="flex items-center gap-3">
        <PersonAvatar
          personId={person.id}
          className={active ? "size-8" : "size-8 opacity-40"}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-k-black-84 text-md">
            {person.name}
            {isSelf ? <span className="text-k-black-40"> (you)</span> : null}
          </div>
          <div className="truncate text-k-black-40 text-md">{person.email}</div>
        </div>

        {canEditRole ? (
          <select
            aria-label={`Role for ${person.name}`}
            value={role}
            disabled={pending}
            onChange={(e) => onRoleChange(e.target.value)}
            className="h-8 shrink-0 rounded-lg border border-k-black-08 bg-background px-2 text-k-black-84 text-md outline-none focus:border-k-blue disabled:opacity-50"
          >
            {assignable.map((r) => (
              <option key={r} value={r}>
                {MEMBER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 text-k-black-40 text-md">
            {MEMBER_ROLE_LABELS[role]}
          </span>
        )}

        <MemberStatus person={person} />
      </div>

      {showTransfer || showRemove ? (
        <div className="flex items-center gap-1 pl-11">
          {showTransfer ? (
            <button
              type="button"
              onClick={onTransfer}
              disabled={pending}
              className="rounded-lg px-2 py-0.5 text-k-black-56 text-sm transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-50"
            >
              Make owner
            </button>
          ) : null}
          {showRemove ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="rounded-lg px-2 py-0.5 text-k-black-56 text-sm transition-colors hover:bg-k-black-04 hover:text-k-red disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Same gate as Remove — `canRemoveMember` asks about the viewer's
          rights over this person, which is the identical question for
          putting them back. */}
      {!active && canRemoveMember(me, person) ? (
        <div className="pl-11">
          <button
            type="button"
            onClick={() => run(() => restoreMemberAction(person.id))}
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

/**
 * Three states, and the distinction matters: "Invited" means the invite was
 * sent but never accepted, which is the only case where resending does
 * anything — `uid` is what first sign-in writes.
 */
function MemberStatus({ person }: { person: Person }) {
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
  return <ResendMemberInviteButton personId={person.id} />;
}
