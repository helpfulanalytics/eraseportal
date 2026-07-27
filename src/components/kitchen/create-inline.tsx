"use client";

/**
 * Inline "name it and go" creation.
 *
 * Deliberately not a modal. Creating a folder or a conversation needs exactly
 * one field, and a dialog for one field is heavier than the task — Kitchen's
 * own create affordances open in place. Clicking the trigger swaps it for an
 * input; Escape or clicking away puts it back.
 *
 * On success it navigates to the thing it just made, because the only reason
 * to create a conversation is to open it.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import {
  createConversationAction,
  createFolderAction,
} from "@/app/(workspace)/actions";
import { cn } from "@/lib/utils";

function InlineCreate({
  placeholder,
  hrefFor,
  create,
  children,
  triggerClassName,
  triggerLabel,
}: {
  placeholder: string;
  hrefFor: (id: string) => string;
  create: (name: string) => Promise<string>;
  children: React.ReactNode;
  triggerClassName: string;
  triggerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const id = await create(trimmed);
        setName("");
        setOpen(false);
        router.push(hrefFor(id));
      } catch {
        setError("Couldn't create that.");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label={triggerLabel}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {children}
      </button>
    );
  }

  return (
    <span className="relative flex items-center gap-1.5">
      <input
        ref={inputRef}
        value={name}
        disabled={pending}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { setOpen(false); setName(""); setError(null); }
        }}
        onBlur={() => { if (!name.trim() && !pending) setOpen(false); }}
        className={cn(
          "h-8 w-52 rounded-lg border border-k-black-12 bg-background px-2.5",
          "text-k-black-84 text-md outline-none placeholder:text-k-gray-ad",
          "focus:border-k-blue disabled:opacity-60",
        )}
      />
      <button
        type="button"
        disabled={!name.trim() || pending}
        onMouseDown={(e) => e.preventDefault()} // beat the input's blur
        onClick={submit}
        className="flex h-8 shrink-0 items-center rounded-lg bg-k-blue px-3 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending ? "…" : "Create"}
      </button>
      {error ? (
        <span role="alert" className="text-k-red text-sm">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Sidebar / workspace-level: makes a folder. */
export function CreateFolderButton({
  className,
}: {
  className?: string;
}) {
  return (
    <InlineCreate
      placeholder="Folder name"
      create={createFolderAction}
      hrefFor={(id) => `/folders/${id}`}
      triggerLabel="New folder"
      triggerClassName={
        className ??
        "flex size-6 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
      }
    >
      <PlusIcon className="size-4" strokeWidth={1.7} />
    </InlineCreate>
  );
}

/** Folder header: makes a conversation inside that folder. */
export function CreateConversationButton({ folderId }: { folderId: string }) {
  return (
    <InlineCreate
      placeholder="Conversation name"
      create={(name) => createConversationAction(folderId, name)}
      hrefFor={(id) => `/conversations/${id}`}
      triggerLabel="Create a conversation"
      triggerClassName="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-06 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-08"
    >
      <PlusIcon className="size-3.5" strokeWidth={1.8} />
      Create
      <ChevronDownIcon className="size-3.5 opacity-60" strokeWidth={1.8} />
    </InlineCreate>
  );
}
