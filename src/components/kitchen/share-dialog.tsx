"use client";

import { CheckIcon, GlobeIcon, LinkIcon, LockIcon, ShareIcon, XIcon, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { usePeople } from "@/components/workspace-provider";
import { isEnabled } from "@/lib/kitchen-flags";
import { cn } from "@/lib/utils";
import { updateResourceAccess, setResourceRole } from "@/app/(workspace)/share-actions";
import type { ResourceRoles, Role } from "@/lib/kitchen-types";

type Access = "invited" | "link";

export function ShareDialog({
  title,
  resourceId,
  resourceType,
  initialAccess = "invited",
  roles = {},
  authorId,
}: {
  title: string;
  resourceId: string;
  resourceType: "conversation" | "folder" | "document" | "board" | "embed";
  initialAccess?: Access;
  roles?: ResourceRoles;
  authorId?: string;
}) {
  const people = usePeople();
  const shareDialogEnabled = isEnabled("shareDialog");
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<Access>(initialAccess);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAccess(initialAccess);
  }, [initialAccess]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyLink() {
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showCopied();
      } else {
        fallbackCopyTextToClipboard(url);
      }
    } catch {
      fallbackCopyTextToClipboard(url);
    }
  }

  function fallbackCopyTextToClipboard(text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        showCopied();
      } else {
        showError();
      }
    } catch {
      showError();
    }

    document.body.removeChild(textArea);
  }

  function showCopied() {
    setCopied(true);
    setCopyError(false);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function showError() {
    setCopyError(true);
    setCopied(false);
    window.setTimeout(() => setCopyError(false), 2000);
  }

  function handleAccessSelect(newAccess: Access) {
    setAccess(newAccess);
    startTransition(async () => {
      try {
        await updateResourceAccess(resourceId, resourceType, newAccess);
      } catch (error) {
        console.error("Failed to update access:", error);
        // Revert on failure
        setAccess(access);
      }
    });
  }

  function handleRoleChange(personId: string, newRole: Role | "remove") {
    startTransition(async () => {
      try {
        await setResourceRole(resourceId, resourceType, personId, newRole === "remove" ? null : newRole);
      } catch (error) {
        console.error("Failed to update role:", error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-84 px-3 text-k-white text-md transition-opacity hover:opacity-90"
      >
        <ShareIcon className="size-3.5" strokeWidth={1.8} />
        Share
      </button>

      {open ? (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-k-black-24 pt-[14vh]"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${title}`}
            onClick={(e) => e.stopPropagation()}
            className="w-[480px] max-w-[calc(100vw-32px)] rounded-3xl bg-background p-5 shadow-overlay"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-medium text-k-black-84 text-section">
                  Share
                </h2>
                <p className="mt-0.5 truncate text-k-black-40 text-md">
                  {title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
              >
                <XIcon className="size-4" strokeWidth={1.7} />
              </button>
            </div>

            {shareDialogEnabled ? (
              <div className="relative mt-4 flex flex-col gap-1.5">
                <AccessOption
                  icon={<LockIcon className="size-4" strokeWidth={1.6} />}
                  title="Invited people only"
                  hint="Only the people listed below can open this."
                  selected={access === "invited"}
                  onSelect={() => handleAccessSelect("invited")}
                  disabled={isPending}
                />
                <AccessOption
                  icon={<GlobeIcon className="size-4" strokeWidth={1.6} />}
                  title="Anyone with the link"
                  hint="Anyone who has the link can view — no sign-in required."
                  selected={access === "link"}
                  onSelect={() => handleAccessSelect("link")}
                  disabled={isPending}
                />
                {isPending && (
                  <div className="absolute right-[-24px] top-1/2 -translate-y-1/2">
                    <Loader2 className="size-4 animate-spin text-k-black-40" />
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="mb-2 text-k-black-40 text-md">People</div>
              <ul className="flex flex-col max-h-[40vh] overflow-y-auto">
                {Object.values(people).map((person) => {
                  const isAuthor = person.id === authorId;
                  const currentRole = roles[person.id];
                  const displayRole = isAuthor ? "Owner" : currentRole;

                  return (
                    <li
                      key={person.id}
                      className="flex items-center gap-2.5 py-2"
                    >
                      <PersonAvatar personId={person.id} className="size-7" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-k-black-84 text-md">
                          {person.name}
                        </div>
                        <div className="truncate text-k-black-40 text-md">
                          {person.email}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 text-k-black-56 text-md">
                        {isAuthor || person.kind === "member" ? (
                          <span>{isAuthor ? "Owner" : "Full access"}</span>
                        ) : (
                          <select
                            className="bg-transparent text-right outline-none cursor-pointer hover:text-k-black-84 disabled:opacity-50"
                            value={currentRole ? "viewer" : "remove"}
                            onChange={(e) => handleRoleChange(person.id, e.target.value === "remove" ? "remove" : "viewer")}
                            disabled={isPending}
                          >
                            <option value="viewer">Can view</option>
                            <option value="remove">No access</option>
                          </select>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 flex items-center gap-2 border-k-black-06 border-t pt-4">
              <button
                type="button"
                onClick={copyLink}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
              >
                {copyError ? (
                  <XIcon className="size-3.5 text-k-red" strokeWidth={2} />
                ) : copied ? (
                  <CheckIcon className="size-3.5 text-k-green-0e" strokeWidth={2} />
                ) : (
                  <LinkIcon className="size-3.5" strokeWidth={1.8} />
                )}
                {copyError ? "Failed to copy" : copied ? "Link copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AccessOption({
  icon,
  title,
  hint,
  selected,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-k-blue bg-k-blue-06"
          : "border-k-black-08 hover:bg-k-black-02",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "mt-px shrink-0",
          selected ? "text-k-blue" : "text-k-black-56",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-k-black-84 text-md">{title}</span>
        <span className="block text-k-black-40 text-md">{hint}</span>
      </span>
      {selected ? (
        <CheckIcon
          className="ml-auto size-4 shrink-0 text-k-blue"
          strokeWidth={2}
        />
      ) : null}
    </button>
  );
}
