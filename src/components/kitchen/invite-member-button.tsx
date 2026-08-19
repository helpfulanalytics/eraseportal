"use client";

/**
 * Trigger for the invite-member dialog. Split out of the (server) Team page
 * for the same reason `NewOrgClientButton` is split out of the admin pages —
 * opening a dialog is client-side state.
 */
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { InviteMemberDialog } from "@/components/kitchen/invite-member-dialog";

export function InviteMemberButton({
  canInviteAdmins,
}: {
  canInviteAdmins: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
      >
        <PlusIcon className="size-3.5" strokeWidth={1.8} />
        Invite member
      </button>
      {open ? (
        <InviteMemberDialog
          canInviteAdmins={canInviteAdmins}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
