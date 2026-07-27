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
 * Modal mechanics follow `share-dialog.tsx`: fixed overlay, click-outside and
 * Escape to dismiss. There's no dialog primitive in ui/, and adding one for a
 * second use isn't worth the divergence.
 *
 * The caller mounts this only while it's open, rather than passing an `open`
 * prop. That gives every open a fresh set of defaults for free — resetting
 * them in an effect instead would mean `setState` inside `useEffect`, which
 * the React Compiler lint rule rejects.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2Icon, LockIcon, Share2Icon, XIcon } from "lucide-react";
import { createFolderAction } from "@/app/(workspace)/actions";
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

export function CreateFolderDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("New folder");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<FolderAccess>("private");
  const [internalRole, setInternalRole] = useState<"viewer" | "editor">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Select rather than just focus: the field opens pre-filled, so the first
    // keystroke should replace the placeholder name instead of appending.
    nameRef.current?.focus();
    nameRef.current?.select();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const id = await createFolderAction({
          name: trimmed,
          description,
          access,
          internalRole,
        });
        onClose();
        router.push(`/folders/${id}`);
      } catch {
        setError("Couldn't create that folder.");
      }
    });
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-k-black-24 px-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create Folder"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-2xl bg-background shadow-xl"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <h2 className="font-semibold text-k-black-84 text-section">
            Create Folder
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 flex size-7 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <XIcon className="size-4.5" strokeWidth={1.7} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6">
          <div>
            <FieldLabel>Folder name</FieldLabel>
            <input
              ref={nameRef}
              value={name}
              disabled={pending}
              aria-label="Folder name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); save(); }
              }}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); save(); }
              }}
              className="h-9 w-full rounded-lg border border-k-black-12 px-3 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60"
            />
          </div>
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

        {error ? (
          <p role="alert" className="px-6 pt-2 text-k-red text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end px-6 pt-4 pb-5">
          <button
            type="button"
            disabled={!name.trim() || pending}
            onClick={save}
            className="flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small caps field label, matching the dialog's uppercase tracking. */
function FieldLabel({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="mb-1.5 text-k-black-40 text-xs uppercase tracking-wider">
      {children}
      {optional ? (
        <span className="ml-1 normal-case tracking-normal">(optional)</span>
      ) : null}
    </div>
  );
}
