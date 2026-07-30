"use client";

import { CheckIcon, GlobeIcon, LinkIcon, LockIcon, ShareIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { usePeople } from "@/components/workspace-provider";
import { isEnabled } from "@/lib/kitchen-flags";
import { cn } from "@/lib/utils";

type Access = "invited" | "link";

/**
 * Share is the product's whole point — external client access — so the button
 * opens a real dialog rather than a placeholder. Nothing is persisted yet;
 * the access toggle and role selects hold local state only.
 */
export function ShareDialog({ title }: { title: string }) {
  const people = usePeople();
  const shareDialogEnabled = isEnabled("shareDialog");
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<Access>("invited");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked by permissions; leave the button idle.
    }
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
              <div className="mt-4 flex flex-col gap-1.5">
                <AccessOption
                  icon={<LockIcon className="size-4" strokeWidth={1.6} />}
                  title="Invited people only"
                  hint="Only the people listed below can open this."
                  selected={access === "invited"}
                  onSelect={() => setAccess("invited")}
                />
                <AccessOption
                  icon={<GlobeIcon className="size-4" strokeWidth={1.6} />}
                  title="Anyone with the link"
                  hint="Anyone who has the link can view — no sign-in required."
                  selected={access === "link"}
                  onSelect={() => setAccess("link")}
                />
              </div>
            ) : null}

            <div className="mt-4">
              <div className="mb-2 text-k-black-40 text-md">People</div>
              <ul className="flex flex-col">
                {Object.values(people).map((person) => (
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
                    <span className="shrink-0 text-k-black-56 text-md">
                      {person.kind === "client" ? "Can view" : "Full access"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex items-center gap-2 border-k-black-06 border-t pt-4">
              <button
                type="button"
                onClick={copyLink}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
              >
                {copied ? (
                  <CheckIcon className="size-3.5 text-k-green-0e" strokeWidth={2} />
                ) : (
                  <LinkIcon className="size-3.5" strokeWidth={1.8} />
                )}
                {copied ? "Link copied" : "Copy link"}
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
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-k-blue bg-k-blue-06"
          : "border-k-black-08 hover:bg-k-black-02",
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
