"use client";

/**
 * Message composer.
 *
 * Every control in the toolbar does something now. The two that look like
 * they'd need a third-party service don't:
 *
 * - **GIF** searches GIPHY through a server proxy, so the API key never
 *   reaches the browser (see `lib/giphy.ts`). Without a key configured the
 *   button still works: a GIF is an image URL, so the picker's link field
 *   attaches one directly.
 * - **Mic** records with `MediaRecorder`, which every browser this app
 *   supports has built in. The clip uploads to Storage like any attachment
 *   and plays back inline. No transcription, no service.
 *
 * Attachments go to `conversations/{conversationId}` — `storage.rules` has
 * had a match block for exactly that prefix since the rules were written,
 * describing "files attached to a conversation message", and nothing had ever
 * written to it. One wildcard segment only, so the object key stays flat
 * (handoff-2, trap 12).
 *
 * `isNote` distinguishes a client-visible message from an internal note.
 * NOTE: that distinction is still cosmetic end to end — `getMessages`
 * returns notes to every reader, so marking one internal changes how it looks
 * and nothing else. Don't rely on it to hide anything from a client account
 * until the read path filters on it.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ImageIcon,
  MicIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PaperclipIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { sendMessageAction } from "@/app/(workspace)/actions";
import { GifPicker } from "@/components/conversation/gif-picker";
import { uploadFile } from "@/lib/firebase/storage";
import { blockedUploadReason, formatBytes } from "@/lib/kitchen-format";
import type { GiphyGif } from "@/lib/giphy";
import type { Attachment } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/** A pending attachment: uploaded to Storage, not yet sent with a message. */
interface Draft extends Attachment {
  /** 0–1 while the bytes are still going up; absent once it's landed. */
  progress?: number;
}

export function Composer({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [gifOpen, setGifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const uploading = drafts.some((d) => d.progress !== undefined);
  const canSend = (value.trim().length > 0 || drafts.length > 0) && !pending && !uploading;

  /** Bytes to Storage first, then the draft chip turns into a real attachment. */
  const upload = async (files: File[]) => {
    setError(null);

    for (const file of files) {
      const reason = blockedUploadReason(file);
      if (reason) {
        setError(reason);
        continue;
      }

      const id = crypto.randomUUID();
      setDrafts((current) => [
        ...current,
        {
          id,
          name: file.name,
          label: fileLabel(file.name, file.type),
          bytes: file.size,
          mime: file.type || undefined,
          progress: 0,
        },
      ]);

      try {
        const result = await uploadFile(
          `conversations/${conversationId}`,
          file,
          (fraction) => {
            setDrafts((current) =>
              current.map((d) => (d.id === id ? { ...d, progress: fraction } : d)),
            );
          },
        );

        setDrafts((current) =>
          current.map((d) =>
            d.id === id
              ? {
                  ...d,
                  bytes: result.bytes,
                  mime: result.mime,
                  url: result.downloadUrl,
                  progress: undefined,
                }
              : d,
          ),
        );
      } catch (cause) {
        setDrafts((current) => current.filter((d) => d.id !== id));
        setError(
          cause instanceof Error && cause.name === "NotSignedInError"
            ? cause.message
            : `Couldn't upload ${file.name}.`,
        );
      }
    }
  };

  // Declared after `upload` so the clip handler isn't closing over a binding
  // that hasn't been initialised yet.
  const recorder = useRecorder({
    onClip: (file) => void upload([file]),
    onError: setError,
  });

  /** A GIPHY result — it tells us its own type and size, so nothing is guessed. */
  const attachGif = (gif: GiphyGif) => {
    setError(null);
    setGifOpen(false);
    setDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: gif.title || "GIF",
        label: "GIF",
        bytes: gif.bytes,
        mime: "image/gif",
        url: gif.url,
      },
    ]);
  };

  /** A remote image or GIF — no bytes of ours, just a URL we point at. */
  const attachLink = (raw: string) => {
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("That needs to be a full https:// link.");
      return;
    }

    setError(null);
    setGifOpen(false);
    setDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: url.split("/").pop()?.split("?")[0] || "Image",
        label: url.toLowerCase().includes(".gif") ? "GIF" : "Image",
        bytes: 0,
        // Guessed rather than fetched: a HEAD request to another origin is
        // usually blocked by CORS, and this only decides how it renders.
        mime: url.toLowerCase().includes(".gif") ? "image/gif" : "image/*",
        url,
      },
    ]);
  };

  const send = () => {
    if (!canSend) return;
    const text = value;
    // The chip's upload progress is UI state, not something a message stores.
    const attachments: Attachment[] = drafts.map((draft) => {
      const { progress, ...rest } = draft;
      void progress;
      return rest;
    });

    // Clear optimistically — the composer should feel immediate, and the
    // failure path puts everything back rather than losing what was typed.
    setValue("");
    setDrafts([]);
    setError(null);

    startTransition(async () => {
      try {
        await sendMessageAction(conversationId, text, isNote, attachments);
      } catch {
        setValue(text);
        setDrafts(attachments);
        setError("Couldn't send that. Try again.");
      }
    });
  };

  return (
    <div className="shrink-0 px-5 pb-5">
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void upload(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <input
        ref={imageRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void upload(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {/*
        The placeholder has promised "just drag files here" since the first
        mock. It does that now.
      */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) {
            void upload(Array.from(e.dataTransfer.files));
          }
        }}
        className={cn(
          "rounded-xl border transition-colors",
          dragging
            ? "border-k-blue border-dashed bg-k-blue-06"
            : isNote
              ? "border-k-yellow-23 bg-k-yellow-08"
              : "border-k-black-12 bg-background focus-within:border-k-black-24",
        )}
      >
        <textarea
          ref={textRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter sends; plain Enter stays a newline, because these
            // are long-form client messages rather than chat one-liners.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={(e) => {
            // A screenshot on the clipboard arrives as a file, not as text.
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void upload(files);
            }
          }}
          rows={2}
          placeholder={
            isNote
              ? "Write an internal note — only your team can see this…"
              : "Write a message or note, or just drag files here..."
          }
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad"
        />

        {drafts.length ? (
          <ul className="flex flex-wrap gap-2 px-4 pb-2">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <DraftChip
                  draft={draft}
                  onRemove={() =>
                    setDrafts((current) => current.filter((d) => d.id !== draft.id))
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        {recorder.state === "recording" ? (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-k-red-08 px-3 py-2">
            <span className="size-2 animate-pulse rounded-full bg-k-red" />
            <span className="flex-1 text-k-black-84 text-md tabular-nums">
              Recording — {formatSeconds(recorder.seconds)}
            </span>
            <button
              type="button"
              onClick={recorder.stop}
              className="flex h-7 items-center gap-1.5 rounded-md bg-k-black-84 px-2.5 text-k-white text-sm"
            >
              <SquareIcon className="size-3" strokeWidth={2} fill="currentColor" />
              Stop
            </button>
            <button
              type="button"
              onClick={recorder.cancel}
              aria-label="Discard recording"
              className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04"
            >
              <Trash2Icon className="size-3.5" strokeWidth={1.7} />
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-1 px-3 pb-3">
          <button
            type="button"
            disabled={!canSend}
            onClick={send}
            className="mr-1 flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Sending…" : uploading ? "Uploading…" : "Send"}
          </button>

          <ComposerAction
            label="Attach file"
            onClick={() => fileRef.current?.click()}
          >
            <PaperclipIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
          <ComposerAction
            label="Insert image"
            onClick={() => imageRef.current?.click()}
          >
            <ImageIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
          <div className="relative">
            <ComposerAction
              label="Add a GIF"
              active={gifOpen}
              onClick={() => setGifOpen((open) => !open)}
            >
              <span className="font-semibold text-2xs tracking-tight">GIF</span>
            </ComposerAction>
            {gifOpen ? (
              <GifPicker
                onPick={attachGif}
                onPickLink={attachLink}
                onClose={() => setGifOpen(false)}
              />
            ) : null}
          </div>

          <div className="relative">
            <ComposerAction
              label="More options"
              active={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
            </ComposerAction>
            {moreOpen ? (
              <MoreMenu
                hasDraft={value.length > 0 || drafts.length > 0}
                isNote={isNote}
                onClose={() => setMoreOpen(false)}
                onLink={() => {
                  setMoreOpen(false);
                  setGifOpen(true);
                }}
                onToggleNote={() => {
                  setMoreOpen(false);
                  setIsNote((v) => !v);
                }}
                onClear={() => {
                  setMoreOpen(false);
                  setValue("");
                  setDrafts([]);
                  setError(null);
                  textRef.current?.focus();
                }}
              />
            ) : null}
          </div>

          <ComposerAction
            label={recorder.state === "recording" ? "Stop recording" : "Record audio"}
            active={recorder.state === "recording"}
            disabled={!recorder.supported}
            title={
              recorder.supported
                ? undefined
                : "This browser has no microphone recording."
            }
            onClick={recorder.state === "recording" ? recorder.stop : recorder.start}
          >
            <MicIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>

          <ComposerAction
            label="Internal note"
            active={isNote}
            onClick={() => setIsNote((v) => !v)}
          >
            <NotebookPenIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 px-1 text-k-red text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ---- pieces ------------------------------------------------------------ */

function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
  const busy = draft.progress !== undefined;

  return (
    <span className="flex items-center gap-2 rounded-lg border border-k-black-08 bg-background py-1 pr-1 pl-2.5">
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate text-k-black-84 text-sm">
          {draft.name}
        </span>
        <span className="block text-k-black-40 text-xs">
          {busy
            ? `Uploading ${Math.round((draft.progress ?? 0) * 100)}%`
            : draft.bytes > 0
              ? `${draft.label} • ${formatBytes(draft.bytes)}`
              : draft.label}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${draft.name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
      >
        <XIcon className="size-3.5" strokeWidth={1.8} />
      </button>
    </span>
  );
}

function MoreMenu({
  hasDraft,
  isNote,
  onLink,
  onToggleNote,
  onClear,
  onClose,
}: {
  hasDraft: boolean;
  isNote: boolean;
  onLink: () => void;
  onToggleNote: () => void;
  onClear: () => void;
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

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="More options"
      className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-56 rounded-xl border border-k-black-08 bg-background p-1.5 shadow-popover"
    >
      <MenuItem onClick={onLink}>Add a GIF or image</MenuItem>
      <MenuItem onClick={onToggleNote}>
        {isNote ? "Send as a normal message" : "Send as an internal note"}
      </MenuItem>
      <div className="my-1 border-k-black-06 border-t" />
      <MenuItem onClick={onClear} disabled={!hasDraft} destructive>
        Clear draft
      </MenuItem>
      <p className="px-2 pt-1.5 pb-0.5 text-k-black-36 text-xs">
        ⌘↵ sends. Enter starts a new line.
      </p>
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "block w-full rounded-lg px-2 py-1.5 text-left text-md transition-colors disabled:opacity-40",
        destructive
          ? "text-k-red hover:bg-k-red-08"
          : "text-k-black-84 hover:bg-k-black-04",
      )}
    >
      {children}
    </button>
  );
}

function ComposerAction({
  label,
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
        active
          ? "bg-k-yellow-16 text-k-black-84"
          : "text-k-black-56 hover:bg-k-black-04 hover:text-k-black-84",
      )}
    >
      {children}
    </button>
  );
}

/* ---- voice notes ------------------------------------------------------- */

/**
 * `MediaRecorder` wrapped so the composer only sees start/stop/cancel and a
 * finished `File`.
 *
 * The mic track is stopped explicitly on every exit path — leaving it open
 * keeps the browser's recording indicator lit long after the clip is done,
 * which reads as the app still listening.
 */
function useRecorder({
  onClip,
  onError,
}: {
  onClip: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  // A component that unmounts mid-recording (navigating away) must not leave
  // the microphone open.
  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setState("idle");
        if (cancelledRef.current || chunksRef.current.length === 0) return;

        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes("mp4") ? "m4a" : "webm";
        onClip(
          new File([blob], `Voice note.${extension}`, { type }),
        );
      };

      recorder.start();
      setSeconds(0);
      setState("recording");
    } catch {
      onError("Couldn't reach the microphone. Check the browser's permission.");
    }
  };

  return {
    state,
    seconds,
    supported,
    start: () => void start(),
    stop: () => recorderRef.current?.stop(),
    cancel: () => {
      cancelledRef.current = true;
      recorderRef.current?.stop();
    },
  };
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** "PDF", "PNG", "Audio" — the short kind shown under an attachment's name. */
function fileLabel(name: string, mime: string): string {
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("video/")) return "Video";
  const extension = name.includes(".") ? name.split(".").pop() : "";
  if (extension) return extension.toUpperCase();
  if (mime.startsWith("image/")) return "Image";
  return "File";
}
