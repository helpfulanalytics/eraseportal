"use client";

import { MoreHorizontalIcon, ReplyIcon, SmilePlusIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deleteMessageAction,
  editMessageAction,
  toggleReactionAction,
} from "@/app/(workspace)/actions";
import { RichText } from "@/components/conversation/rich-text";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, usePeople, usePerson } from "@/components/workspace-provider";
import { isEnabled } from "@/lib/kitchen-flags";
import { blocksToText, formatBytes, formatShortDate } from "@/lib/kitchen-format";
import type { Attachment, Message, Reaction } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/**
 * The emoji the picker offers. A fixed set rather than a full picker: the
 * server only accepts one or two code points back, and eight covers what
 * people actually use on a work thread without shipping an emoji index.
 */
const QUICK_REACTIONS = ["👍", "🎉", "✅", "👀", "🙏", "❤️", "😄", "🔥"];

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

export function MessageList({
  messages,
  onReply,
}: {
  messages: Message[];
  /** Wired to the composer above — Reply seeds its "Replying to" bar. */
  onReply?: (message: Message) => void;
}) {
  const focusedId = useFocusedMessage();
  const messagesById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  );

  return (
    <ol className="flex flex-col gap-5 px-5 py-6">
      {messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          focused={message.id === focusedId}
          parentMessage={
            message.replyToMessageId
              ? messagesById.get(message.replyToMessageId)
              : undefined
          }
          onReply={onReply}
        />
      ))}
    </ol>
  );
}

function MessageRow({
  message,
  focused,
  parentMessage,
  onReply,
}: {
  message: Message;
  focused: boolean;
  parentMessage: Message | undefined;
  onReply?: (message: Message) => void;
}) {
  const author = usePerson(message.authorId);
  const currentUser = useCurrentUser();
  const isOwn = message.authorId === currentUser?.id;
  const canEdit = isOwn || currentUser?.kind === "member";
  const people = usePeople();
  const handles = useMemo(
    () => Object.fromEntries(Object.values(people).map((p) => [p.id, p.handle])),
    [people],
  );

  // Reactions are held locally so a pill flips the instant it's clicked. The
  // server's answer replaces this — it's authoritative about who else has
  // reacted since the page rendered.
  const [reactions, setReactions] = useState<Reaction[]>(message.reactions ?? []);
  const [serverReactions, setServerReactions] = useState(message.reactions);
  const [picking, setPicking] = useState(false);
  const [, startTransition] = useTransition();

  // The same adjust-state-when-a-prop-changes shape the board uses: a
  // revalidation that brings new reactions down must win over stale local
  // state, without an effect (handoff-2, trap 13).
  if (message.reactions !== serverReactions) {
    setServerReactions(message.reactions);
    setReactions(message.reactions ?? []);
  }

  // Same shape again for edit/delete: body, editedAt and deletedAt all move
  // together, so one prop-changed check covers all three.
  const [body, setBody] = useState(message.body);
  const [editedAt, setEditedAt] = useState(message.editedAt);
  const [deletedAt, setDeletedAt] = useState(message.deletedAt);
  const [serverBody, setServerBody] = useState(message.body);
  if (message.body !== serverBody) {
    setServerBody(message.body);
    setBody(message.body);
    setEditedAt(message.editedAt);
    setDeletedAt(message.deletedAt);
  }

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(blocksToText(body, handles));
    setEditing(true);
  };

  const saveEdit = () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    startTransition(async () => {
      try {
        const edited = await editMessageAction(message.id, text);
        setBody(edited.body);
        setEditedAt(edited.editedAt);
        setEditing(false);
      } catch {
        // Leave the textarea open with what they typed rather than losing it.
      } finally {
        setSaving(false);
      }
    });
  };

  const remove = () => {
    if (!window.confirm("Delete this message? This can't be undone.")) return;
    const now = new Date().toISOString();
    setBody([]);
    setDeletedAt(now);
    startTransition(async () => {
      try {
        await deleteMessageAction(message.id);
      } catch {
        // Put it back if the write didn't land.
        setBody(message.body);
        setDeletedAt(message.deletedAt);
      }
    });
  };

  const react = (emoji: string) => {
    if (!currentUser) return;
    setPicking(false);
    setReactions((current) => applyReaction(current, emoji, currentUser.id));

    startTransition(async () => {
      try {
        setReactions(await toggleReactionAction(message.id, emoji));
      } catch {
        // Put the optimistic toggle back if the write didn't land.
        setReactions(message.reactions ?? []);
      }
    });
  };

  const deleted = Boolean(deletedAt);

  return (
    <li id={message.id} className="group/msg scroll-mt-6">
      {parentMessage ? <ReplyReference message={parentMessage} /> : null}

      <div className="mb-1.5 flex items-center gap-2">
        <PersonAvatar personId={message.authorId} className="size-5" />
        <span className="font-semibold text-k-black-84 text-md">
          {author?.name}
        </span>
        <span className="text-k-black-40 text-md">
          {formatShortDate(message.createdAt)}
        </span>
        {editedAt && !deleted ? (
          <span className="text-k-black-36 text-sm">(edited)</span>
        ) : null}
        {message.isNote ? (
          <span className="rounded bg-k-yellow-16 px-1.5 py-px font-medium text-2xs text-k-black-72">
            Note
          </span>
        ) : null}
      </div>

      <div className="relative">
        {/*
          A deep-linked message keeps its own bubble colour. It used to turn
          white with a blue ring, which read as a different kind of message
          rather than as "this is the one you followed a link to" — the scroll
          and the brief outline below do that job without recolouring it.
        */}
        <div
          className={cn(
            "rounded-xl px-4 py-3 transition-colors",
            isOwn && !deleted ? "bg-k-blue-06" : "bg-k-black-03-solid",
            focused && "outline outline-2 outline-k-blue-32 outline-offset-2",
          )}
        >
          {deleted ? (
            <p className="text-k-black-36 text-md italic">Message deleted</p>
          ) : editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                  }
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveEdit();
                  }
                }}
                rows={2}
                className="w-full resize-none rounded-lg border border-k-black-16 bg-background px-2.5 py-2 text-k-black-84 text-md outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={saveEdit}
                  className="flex h-7 items-center rounded-lg bg-k-blue px-3 font-medium text-k-white text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex h-7 items-center rounded-lg px-3 text-k-black-56 text-sm hover:bg-k-black-04"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <RichText blocks={body} />
          )}

          {!deleted && !editing && message.attachments?.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map((file) => (
                <li key={file.id} className={isMedia(file) ? "w-full" : undefined}>
                  <AttachmentView file={file} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {!deleted && !editing ? (
          <div className="-top-3 absolute right-2 flex items-center gap-0.5 rounded-lg bg-background p-0.5 opacity-0 shadow-popover transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
            <HoverAction
              label="React"
              aria-expanded={picking}
              onClick={() => setPicking((open) => !open)}
            >
              <SmilePlusIcon className="size-4" strokeWidth={1.6} />
            </HoverAction>
            {isEnabled("messageActions") ? (
              <>
                <HoverAction label="Reply" onClick={() => onReply?.(message)}>
                  <ReplyIcon className="size-4" strokeWidth={1.6} />
                </HoverAction>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="More"
                      title="More"
                      className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
                    >
                      <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={startEdit}>Edit</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={remove}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {picking ? (
          <EmojiPicker
            reactions={reactions}
            currentUserId={currentUser?.id}
            onPick={react}
            onClose={() => setPicking(false)}
          />
        ) : null}
      </div>

      {!deleted && reactions.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {reactions.map((reaction) => (
            <ReactionPill
              key={reaction.emoji}
              reaction={reaction}
              mine={Boolean(currentUser && reaction.personIds.includes(currentUser.id))}
              onClick={() => react(reaction.emoji)}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The quoted preview above a reply — author + a one-line snippet of the
 * parent's body, linking to the `#messageId` anchor every row already
 * carries so a click reuses the existing hash-driven scroll-and-highlight
 * (`useFocusedMessage` above) instead of a bespoke scroll handler.
 */
function ReplyReference({ message }: { message: Message }) {
  const author = usePerson(message.authorId);
  const people = usePeople();
  const handles = useMemo(
    () => Object.fromEntries(Object.values(people).map((p) => [p.id, p.handle])),
    [people],
  );
  const preview = message.deletedAt
    ? "Message deleted"
    : blocksToText(message.body, handles).replace(/\s+/g, " ").trim();

  return (
    <a
      href={`#${message.id}`}
      className="mb-1 flex items-center gap-1.5 pl-6 text-k-black-40 text-sm hover:text-k-black-72"
    >
      <ReplyIcon className="size-3 shrink-0 -scale-x-100" strokeWidth={1.8} />
      <span className="truncate">
        <span className="font-medium">{author?.name ?? "Someone"}</span>
        {preview ? `: ${preview.slice(0, 80)}` : ""}
      </span>
    </a>
  );
}

/* ---- attachments ------------------------------------------------------- */

function isImage(file: Attachment): boolean {
  return Boolean(file.url && file.mime?.startsWith("image/"));
}

function isAudio(file: Attachment): boolean {
  return Boolean(file.url && file.mime?.startsWith("audio/"));
}

function isMedia(file: Attachment): boolean {
  return isImage(file) || isAudio(file);
}

/**
 * An attachment renders as the thing it is: images inline, voice notes as a
 * player, everything else as a chip that downloads.
 *
 * Seeded attachments have no `url` — they were fixtures with no bytes behind
 * them — so those stay a chip you can read but not open, rather than a link
 * that 404s.
 */
function AttachmentView({ file }: { file: Attachment }) {
  if (isImage(file)) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className="block">
        {/*
          A Storage download URL is not a configured next/image remote
          pattern, and adding one per bucket for user uploads isn't worth it.
          eslint-disable-next-line @next/next/no-img-element
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.url}
          alt={file.name}
          className="max-h-80 max-w-full rounded-lg border border-k-black-08 object-contain"
        />
      </a>
    );
  }

  if (isAudio(file)) {
    return (
      <div className="w-full rounded-lg border border-k-black-08 bg-background px-3 py-2">
        <div className="mb-1 text-k-black-56 text-sm">{file.name}</div>
        <audio src={file.url} controls className="w-full">
          <track kind="captions" />
        </audio>
      </div>
    );
  }

  const chip = (
    <>
      <span className="flex h-8 w-6 shrink-0 flex-col justify-center gap-[3px] rounded-[3px] border border-k-black-12 px-1">
        {[5, 3, 4].map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="h-[1.5px] rounded-full bg-k-black-16"
            style={{ width: `${w * 3}px` }}
          />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[220px] truncate text-k-black-84 text-md">
          {file.name}
        </span>
        <span className="block text-k-black-40 text-sm">
          {file.bytes > 0 ? `${file.label} • ${formatBytes(file.bytes)}` : file.label}
        </span>
      </span>
    </>
  );

  if (!file.url) {
    return (
      <span
        title="This attachment has no file behind it."
        className="flex items-center gap-2.5 rounded-lg border border-k-black-08 bg-background px-3 py-2 opacity-70"
      >
        {chip}
      </span>
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      download={file.name}
      className="flex items-center gap-2.5 rounded-lg border border-k-black-08 bg-background px-3 py-2 text-left transition-colors hover:border-k-black-12"
    >
      {chip}
    </a>
  );
}

/** A pill is a toggle: clicking it adds or removes your own reaction. */
function ReactionPill({
  reaction,
  mine,
  onClick,
}: {
  reaction: Reaction;
  mine: boolean;
  onClick: () => void;
}) {
  const people = usePeople();
  const names = reaction.personIds
    .map((id) => people[id]?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={mine}
      title={names ? `${names} reacted with ${reaction.emoji}` : undefined}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-md transition-colors",
        mine
          ? "border-k-blue bg-k-blue-08 text-k-blue"
          : "border-k-black-08 bg-background hover:border-k-black-16",
      )}
    >
      <span aria-hidden="true">{reaction.emoji}</span>
      <span className={cn("text-sm", mine ? "text-k-blue" : "text-k-black-56")}>
        {reaction.personIds.length}
      </span>
    </button>
  );
}

function EmojiPicker({
  reactions,
  currentUserId,
  onPick,
  onClose,
}: {
  reactions: Reaction[];
  currentUserId: string | undefined;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const mine = new Set(
    currentUserId
      ? reactions
          .filter((r) => r.personIds.includes(currentUserId))
          .map((r) => r.emoji)
      : [],
  );

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Add a reaction"
      className="-top-1 absolute right-2 z-20 flex items-center gap-0.5 rounded-xl border border-k-black-08 bg-background p-1 shadow-popover"
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          // `menuitemcheckbox`, not `menuitem`: picking an emoji you've
          // already used takes the reaction away again, so the row has a
          // checked state and has to say so.
          role="menuitemcheckbox"
          aria-label={`React with ${emoji}`}
          aria-checked={mine.has(emoji)}
          onClick={() => onPick(emoji)}
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-md transition-colors",
            mine.has(emoji) ? "bg-k-blue-08" : "hover:bg-k-black-04",
          )}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The optimistic half of `toggleReaction` in kitchen-data.ts — same rules, so
 * the pill that flips on click matches what comes back from the server.
 */
function applyReaction(
  current: Reaction[],
  emoji: string,
  personId: string,
): Reaction[] {
  const existing = current.find((r) => r.emoji === emoji);
  if (!existing) return [...current, { emoji, personIds: [personId] }];

  if (existing.personIds.includes(personId)) {
    const personIds = existing.personIds.filter((id) => id !== personId);
    return personIds.length
      ? current.map((r) => (r.emoji === emoji ? { ...r, personIds } : r))
      : current.filter((r) => r.emoji !== emoji);
  }

  return current.map((r) =>
    r.emoji === emoji ? { ...r, personIds: [...r.personIds, personId] } : r,
  );
}

function HoverAction({
  label,
  children,
  ...props
}: {
  label: string;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
    >
      {children}
    </button>
  );
}
