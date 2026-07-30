"use client";

/**
 * Create Folder — ported from a capture of the real dialog.
 *
 * Name, optional description, and a "Who can access" radio group whose third
 * option carries its own role select. The name field is pre-filled with
 * "New folder" and selected on open, so typing replaces it and Enter alone is
 * a valid path through the whole dialog.
 *
 * The access choice is stored but **not enforced** — see `FolderAccess` in
 * kitchen-types.ts. Every signed-in user still sees every folder.
 *
 * Folder has its own dialog rather than sharing `CreateItemDialog` because
 * it's the only type with a description and an access group; the chrome they
 * do share lives in `DialogShell`.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2Icon, LockIcon, Share2Icon } from "lucide-react";
import { createFolderAction } from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";
import type { FolderAccess } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const ACCESS: Array<{
  value: FolderAccess;
  icon: React.ElementType;
  label: string;
  hint: string;
}> = [
  { value: "private", icon: LockIcon, label: "Private", hint: "Only invited members" },
  { value: "clients", icon: Share2Icon, label: "Shared with Clients", hint: "Only invited clients and members" },
  { value: "internal", icon: Building2Icon, label: "Internal", hint: "Any member invited to your workspace" },
];

export function CreateFolderDialog({
  organizations,
  onClose,
}: {
  /**
   * Every folder now lives under its organization's `/w/{slug}` portal, so
   * there's no "agency internal, no org" option anymore — the picker is
   * required whenever this dialog can reach more than one org.
   */
  organizations: Array<{ id: string; name: string; slug: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("New folder");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<FolderAccess>("private");
  const [internalRole, setInternalRole] = useState<"viewer" | "editor">("viewer");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Select rather than just focus: the field opens pre-filled, so the first
    // keystroke should replace the placeholder name instead of appending.
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || pending || !organizationId) return;
    setError(null);

    startTransition(async () => {
      try {
        const id = await createFolderAction({
          name: trimmed,
          description,
          access,
          internalRole,
          organizationId,
        });
        onClose();
        const slug = organizations.find((o) => o.id === organizationId)?.slug;
        router.push(`/w/${slug}/folders/${id}`);
      } catch {
        setError("Couldn't create that folder.");
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
      title="Create Folder"
      onClose={onClose}
      onSubmit={save}
      canSubmit={Boolean(name.trim()) && Boolean(organizationId)}
      pending={pending}
      error={error}
    >
      <div className="flex flex-col gap-4 px-6">
        <div>
          <FieldLabel>Folder name</FieldLabel>
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label="Folder name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            // Opens focused and selected, so it carries the focus ring already.
            className="h-9 w-full rounded-lg border border-k-blue px-3 text-k-black-84 text-md outline-none ring-2 ring-k-blue-08 disabled:opacity-60"
          />
        </div>

        <div>
          <FieldLabel optional>Description</FieldLabel>
          <input
            value={description}
            disabled={pending}
            placeholder="Enter description..."
            aria-label="Folder description"
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>

        {organizations.length > 0 ? (
          <div>
            <FieldLabel>Organization</FieldLabel>
            <select
              value={organizationId}
              disabled={pending}
              aria-label="Organization"
              onChange={(e) => setOrganizationId(e.target.value)}
              className={`${dialogFieldClass} bg-background`}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-k-black-40 text-sm">
            Create an organization first — every folder belongs to one.
          </p>
        )}
      </div>

      <div className="mt-5 border-k-black-06 border-t px-6 pt-4">
        <div className="text-k-black-56 text-md">Who can access</div>

        <div role="radiogroup" aria-label="Who can access" className="mt-2">
          {ACCESS.map((option) => {
            const selected = access === option.value;
            return (
              <div key={option.value} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onClick={() => setAccess(option.value)}
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    selected
                      ? "border-k-blue border-[5px]"
                      : "border-k-black-24 hover:border-k-black-40",
                  )}
                />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-k-black-04 text-k-black-84">
                  <option.icon className="size-4" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-k-black-84 text-md">
                    {option.label}
                  </span>
                  <span className="block truncate text-k-black-40 text-md">
                    {option.hint}
                  </span>
                </span>

                {option.value === "internal" ? (
                  <select
                    value={internalRole}
                    aria-label="Internal access role"
                    disabled={access !== "internal"}
                    onChange={(e) =>
                      setInternalRole(e.target.value as "viewer" | "editor")
                    }
                    className="shrink-0 rounded-md bg-transparent px-1 py-0.5 text-k-black-84 text-md outline-none disabled:opacity-40"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </DialogShell>
  );
}
