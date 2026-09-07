"use client";

/**
 * A one-time nudge to enable push notifications, shown a few seconds after
 * the workspace first loads rather than requiring someone to find "Enable
 * Notifications" buried in the avatar menu (still there, for later). Skipped
 * outright once the browser already has a permission decision recorded —
 * granted or denied — since there'd be nothing useful to ask. Dismissing it
 * (either button) remembers the choice in `localStorage` so it never nags
 * twice.
 */
import { BellIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { registerDeviceTokenAction } from "@/app/(workspace)/actions";
import { requestNotificationPermission } from "@/lib/firebase/messaging";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "workspace:push-prompt-dismissed";
const SHOW_DELAY_MS = 3000;

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "true") return;

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  const enable = async () => {
    setPending(true);
    try {
      const token = await requestNotificationPermission();
      if (token) await registerDeviceTokenAction(token);
    } catch (error) {
      console.error(error);
    } finally {
      // Whatever the outcome, the browser now has a real permission
      // decision (or the user just said no) — nothing left to ask.
      window.localStorage.setItem(DISMISSED_KEY, "true");
      setPending(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 left-[calc(var(--k-rail-width)+16px)] z-40 flex w-80 items-start gap-3 rounded-xl border border-k-black-08 bg-background p-4 shadow-popover",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-k-blue-08 text-k-blue">
        <BellIcon className="size-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-k-black-84 text-md">Stay in the loop</p>
        <p className="mt-0.5 text-k-black-40 text-sm">
          Get notified here when someone messages you or updates a board.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={enable}
            disabled={pending}
            className="flex h-7 items-center rounded-lg bg-k-blue px-3 font-medium text-k-white text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Enabling…" : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-k-black-40 text-sm hover:text-k-black-84"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="-mt-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-36 hover:bg-k-black-04 hover:text-k-black-84"
      >
        <XIcon className="size-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}
