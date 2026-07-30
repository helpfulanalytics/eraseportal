"use client";

/**
 * Read-only display of an org's `/w/{slug}` portal URL, with a copy button.
 * Replaces the old Settings page's fake "Workspace URL" input (a
 * `defaultValue="kea-marketing"` that saved nowhere) with the real thing.
 */
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

export function PortalLinkField({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked by permissions; leave the button idle.
    }
  };

  return (
    <div className="flex h-8 items-center gap-2 rounded-lg border border-k-black-08 px-3 text-md">
      <span className="min-w-0 flex-1 truncate text-k-black-84">{path}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy portal link"
        className="flex shrink-0 items-center gap-1 text-k-black-56 transition-colors hover:text-k-black-84"
      >
        {copied ? (
          <CheckIcon className="size-3.5 text-k-green-0e" strokeWidth={2} />
        ) : (
          <CopyIcon className="size-3.5" strokeWidth={1.8} />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
