"use client";

/**
 * Adds an agency member and emails them a link to claim the seat.
 *
 * The member counterpart of `CreateOrgClientDialog`, on the same
 * `DialogShell` primitives, with a role select added. Unlike that one there's
 * no out-of-band step: `/sign-up` is retired, so the emailed token is the
 * only way this person gets in.
 *
 * `owner` isn't offered — there's exactly one, and it moves via the Team
 * page's "Make owner" transfer rather than by minting a second.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMemberAction } from "@/app/(workspace)/team-actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";
import {
  MEMBER_ROLE_HINTS,
  MEMBER_ROLE_LABELS,
} from "@/lib/permissions";
import type { MemberRole } from "@/lib/kitchen-types";

export function InviteMemberDialog({
  canInviteAdmins,
  onClose,
}: {
  /** Only the owner may create other admins — see `inviteMemberAction`. */
  canInviteAdmins: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSubmit = Boolean(name.trim()) && Boolean(email.trim());

  const save = () => {
    if (!canSubmit || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        await inviteMemberAction(name.trim(), email.trim(), role);
        onClose();
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't send that invite.",
        );
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
      title="Invite a team member"
      subtitle="They'll get an email with a link to set a password."
      onClose={onClose}
      onSubmit={save}
      canSubmit={canSubmit}
      pending={pending}
      error={error}
    >
      <div className="flex flex-col gap-4 px-6">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label="Team member name"
            placeholder="Jane Doe"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            value={email}
            type="email"
            disabled={pending}
            aria-label="Team member email"
            placeholder="jane@keamarketing.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <select
            value={role}
            disabled={pending}
            aria-label="Role"
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className={dialogFieldClass}
          >
            <option value="member">{MEMBER_ROLE_LABELS.member}</option>
            {canInviteAdmins ? (
              <option value="admin">{MEMBER_ROLE_LABELS.admin}</option>
            ) : null}
          </select>
          <p className="mt-1 text-k-black-40 text-sm">
            {MEMBER_ROLE_HINTS[role]}
          </p>
        </div>
      </div>
    </DialogShell>
  );
}
