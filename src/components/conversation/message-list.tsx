"use client";

import { MoreHorizontalIcon, ReplyIcon, SmilePlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { RichText } from "@/components/conversation/rich-text";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { useCurrentUser, usePerson } from "@/components/workspace-provider";
import { formatBytes, formatShortDate } from "@/lib/kitchen-format";
import type { Message } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/**
 * Reads the `#msg_…` deep link. The hash isn't exposed through the router, so
 * it's read off the location directly and kept in sync with `hashchange` —
 * clicking a second link to the same page must re-highlight.
 */
function useFocusedMessage() {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    function read() {
      setHash(window.location.hash.slice(1) || null);
    }
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (!hash) return;
    // Defer so the list has painted before we measure scroll position.
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(hash)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [hash]);

  return hash;
}

export function MessageList({ messages }: { messages: Message[] }) {
  const focusedId = useFocusedMessage();

  return (
    <ol className="flex flex-col gap-5 px-5 py-6">
      {messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          focused={message.id === focusedId}
        />
      ))}
    </ol>
  );
}

function MessageRow({
  message,
  focused,
}: {
  message: Message;
  focused: boolean;
}) {
  const author = usePerson(message.authorId);
  const currentUser = useCurrentUser();
  const isOwn = message.authorId === currentUser?.id;

  return (
    <li id={message.id} className="group/msg scroll-mt-6">
      <div className="mb-1.5 flex items-center gap-2">
        <PersonAvatar personId={message.authorId} className="size-5" />
        <span className="font-semibold text-k-black-84 text-md">
          {author?.name}
        </span>
        <span className="text-k-black-40 text-md">
          {formatShortDate(message.createdAt)}
        </span>
        {message.isNote ? (
          <span className="rounded bg-k-yellow-16 px-1.5 py-px font-medium text-2xs text-k-black-72">
            Note
          </span>
        ) : null}
      </div>

      <div className="relative">
        <div
          className={cn(
            "rounded-xl px-4 py-3 transition-colors",
            focused
              ? "bg-background ring-2 ring-k-blue"
              : isOwn
                ? "bg-k-blue-06"
                : "bg-k-black-03-solid",
          )}
        >
          <RichText blocks={message.body} />

          {message.attachments?.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 rounded-lg border border-k-black-08 bg-background px-3 py-2 text-left transition-colors hover:border-k-black-12"
                  >
                    <span className="flex h-8 w-6 flex-col justify-center gap-[3px] rounded-[3px] border border-k-black-12 px-1">
                      {[5, 3, 4].map((w, i) => (
                        <span
                          key={`${w}-${i}`}
                          className="h-[1.5px] rounded-full bg-k-black-16"
                          style={{ width: `${w * 3}px` }}
                        />
                      ))}
                    </span>
                    <span>
                      <span className="block text-k-black-84 text-md">
                        {file.name}
                      </span>
                      <span className="block text-k-black-40 text-sm">
                        {file.label} • {formatBytes(file.bytes)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="-top-3 absolute right-2 flex items-center gap-0.5 rounded-lg bg-background p-0.5 opacity-0 shadow-popover transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
          <HoverAction label="React">
            <SmilePlusIcon className="size-4" strokeWidth={1.6} />
          </HoverAction>
          <HoverAction label="Reply">
            <ReplyIcon className="size-4" strokeWidth={1.6} />
          </HoverAction>
          <HoverAction label="More">
            <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
          </HoverAction>
        </div>
      </div>

      {message.reactions?.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {message.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              className="flex items-center gap-1 rounded-full border border-k-black-08 bg-background px-2 py-0.5 text-md transition-colors hover:border-k-black-16"
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              <span className="text-k-black-56 text-sm">
                {reaction.personIds.length}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function HoverAction({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
    >
      {children}
    </button>
  );
}
