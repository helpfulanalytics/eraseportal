"use client";

/**
 * Admin-only: seeds a client `Person` inside a known organization. This is
 * the invite flow — there's no token. The admin creates the record here,
 * then shares the existing `/sign-up` URL with that person out of band;
 * first sign-in adopts this record via the uid/email match in
 * `getCurrentUser()` (see `kitchen-data.ts`).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientAction } from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";

export function CreateOrgClientDialog({
  organizationId,
  onClose,
}: {
  organizationId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
        await createClientAction(name.trim(), email.trim(), organizationId);
        onClose();
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't create that client.",
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
      title="New client"
      subtitle="Share the sign-up link with them once they're created."
      onClose={onClose}
      onSubmit={save}
      canSubmit={canSubmit}
      pending={pending}
      error={error}
    >
      <div className="flex flex-col gap-4 px-6">
        <div>
          <FieldLabel>Client name</FieldLabel>
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label="Client name"
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
            aria-label="Client email"
            placeholder="client@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>
      </div>
    </DialogShell>
  );
}
