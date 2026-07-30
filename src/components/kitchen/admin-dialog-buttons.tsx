"use client";

/**
 * Thin trigger button for the admin-only "new client" dialog. Split out of
 * the (server) admin pages because opening a dialog is client-side state —
 * matches the pattern `CreateMenu`'s `initial` prop uses for a single-type
 * "click straight into a dialog" trigger.
 *
 * Organization creation isn't a dialog anymore — it moved to the full-page
 * `/admin/new` project creator, which also creates the org's first folder in
 * the same flow. See `src/components/kitchen/new-project-form.tsx`.
 */
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateOrgClientDialog } from "@/components/kitchen/create-org-client-dialog";

export function NewOrgClientButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
      >
        <PlusIcon className="size-3.5" strokeWidth={1.8} />
        New client
      </button>
      {open ? (
        <CreateOrgClientDialog organizationId={organizationId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
