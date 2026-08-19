"use client";

/**
 * The member twin of `ResendInviteButton`. Same shape, different action —
 * kept separate rather than parameterised because the two invite paths are
 * authorized differently (`requireTeamAdmin` vs `requireAdmin`) and a single
 * button taking a "which kind" prop would blur that.
 */
import { MailIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { resendMemberInviteAction } from "@/app/(workspace)/team-actions";

export function ResendMemberInviteButton({ personId }: { personId: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const resend = () => {
    startTransition(async () => {
      try {
        await resendMemberInviteAction(personId);
        setSent(true);
        window.setTimeout(() => setSent(false), 2000);
      } catch {
        // Non-fatal to the page — the button just stays clickable to retry.
      }
    });
  };

  return (
    <button
      type="button"
      onClick={resend}
      disabled={pending}
      className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-k-black-56 text-sm transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-50"
    >
      <MailIcon className="size-3.5" strokeWidth={1.7} />
      {sent ? "Sent" : "Resend invite"}
    </button>
  );
}
