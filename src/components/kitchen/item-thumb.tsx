"use client";

/**
 * The thumbnail for a folder item.
 *
 * Everything in a folder used to render as one of two things: a lucide glyph
 * or the same grey page shape, so a board, a canvas and a 9 MB PDF were
 * visually identical at a glance. This gives each kind a placeholder that
 * says what it is, and shows the real thing where there is one:
 *
 * - **Image uploads** render the image itself.
 * - **Other files** get a page with their extension on it, tinted by type —
 *   a PDF reads as a PDF without reading the filename.
 * - **Page documents** get ruled lines; **canvases** get sticky notes;
 *   **boards** get columns; **conversations** get bubbles. All drawn rather
 *   than screenshotted: a real thumbnail would mean rendering each document
 *   server-side, which is a service, not a component.
 *
 * Two sizes, because the same thumbnail has to work as a 32px row marker and
 * as the top half of a grid card.
 */
import { LinkIcon } from "lucide-react";
import type { ItemKind } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

export interface ThumbSubject {
  kind: ItemKind;
  /** Canvas documents and Link embeds draw differently from their siblings. */
  variant?: "canvas" | "link";
  file?: { label: string; mime?: string; url?: string };
  url?: string;
}

/**
 * Extension tints. Kept to the accent ramp rather than inventing colours: a
 * document type is a category, and the palette already has five of those.
 */
const FILE_TINT: Array<{ match: RegExp; className: string }> = [
  { match: /^(pdf)$/i, className: "bg-k-red-08 text-k-red-d3" },
  { match: /^(docx?|rtf|txt|md|pages)$/i, className: "bg-k-blue-08 text-k-blue" },
  { match: /^(xlsx?|csv|numbers)$/i, className: "bg-k-green-23 text-k-green-0e" },
  { match: /^(pptx?|key)$/i, className: "bg-k-yellow-23 text-k-black-72" },
  { match: /^(zip|rar|7z|tar|gz)$/i, className: "bg-k-purple-20 text-k-black-72" },
];

function tintFor(label: string): string {
  return (
    FILE_TINT.find((entry) => entry.match.test(label))?.className ??
    "bg-k-black-06 text-k-black-56"
  );
}

export function ItemThumb({
  subject,
  size = "row",
  name,
  className,
}: {
  subject: ThumbSubject;
  /** `row` is the 32px list marker; `card` fills a grid tile's preview area. */
  size?: "row" | "card";
  /** Alt text for a real image thumbnail. */
  name?: string;
  className?: string;
}) {
  const card = size === "card";
  const frame = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden",
    card
      ? "aspect-[4/3] w-full rounded-lg border border-k-black-08 bg-k-gray-f8"
      : "h-9 w-8 rounded-[3px] border border-k-black-12 bg-background",
    className,
  );

  // A real image is the best thumbnail there is.
  if (subject.file?.url && subject.file.mime?.startsWith("image/")) {
    return (
      <span className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a Storage
        download URL isn't a configured next/image remote pattern, and adding
        one per bucket for user uploads isn't worth it. */}
        <img
          src={subject.file.url}
          alt={name ?? ""}
          loading="lazy"
          className="size-full object-cover"
        />
      </span>
    );
  }

  if (subject.kind === "file") {
    const label = (subject.file?.label ?? "File").slice(0, 4);
    return (
      <span className={cn(frame, "flex-col gap-1")}>
        <Lines count={card ? 5 : 4} />
        <span
          className={cn(
            "absolute right-0 bottom-0 rounded-tl font-semibold tracking-tight",
            tintFor(label),
            card ? "px-1.5 py-0.5 text-2xs" : "px-1 text-[7px] leading-[10px]",
          )}
        >
          {label.toUpperCase()}
        </span>
      </span>
    );
  }

  if (subject.kind === "document") {
    return (
      <span className={frame}>
        {subject.variant === "canvas" ? <CanvasArt card={card} /> : <Lines count={card ? 6 : 4} />}
      </span>
    );
  }

  if (subject.kind === "board") {
    return (
      <span className={frame}>
        <BoardArt card={card} />
      </span>
    );
  }

  if (subject.kind === "conversation") {
    return (
      <span className={frame}>
        <ChatArt card={card} />
      </span>
    );
  }

  if (subject.kind === "embed") {
    if (subject.url && card) {
      return (
        <span className={cn(frame, "relative overflow-hidden bg-white")}>
          <iframe
            src={subject.url}
            className="absolute top-0 left-0 h-[400%] w-[400%] origin-top-left border-0"
            style={{ transform: "scale(0.25)", pointerEvents: "none" }}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            tabIndex={-1}
          />
          <div className="absolute inset-0 z-10" />
        </span>
      );
    }
    return (
      <span className={frame}>
        <LinkIcon
          className={cn("text-k-black-36", card ? "size-8" : "size-4")}
          strokeWidth={1.6}
        />
      </span>
    );
  }

  return (
    <span className={frame}>
      <LinkIcon
        className={cn("text-k-black-36", card ? "size-8" : "size-4")}
        strokeWidth={1.6}
      />
    </span>
  );
}

/* ---- the drawn placeholders -------------------------------------------- */

/** Ruled lines — a page of text, at whatever size. */
function Lines({ count }: { count: number }) {
  const widths = [90, 70, 82, 55, 76, 64];
  return (
    <span className="flex w-full flex-col gap-[3px] px-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="h-[2px] rounded-full bg-k-black-16"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </span>
  );
}

function CanvasArt({ card }: { card: boolean }) {
  const notes = [
    { left: "12%", top: "18%", color: "var(--k-yellow)" },
    { left: "46%", top: "34%", color: "var(--k-blue)" },
    { left: "24%", top: "56%", color: "var(--k-green)" },
  ];
  return (
    <span className="absolute inset-0">
      {notes.map((note) => (
        <span
          key={note.left}
          style={{
            left: note.left,
            top: note.top,
            width: card ? "30%" : "34%",
            height: card ? "34%" : "30%",
            backgroundColor: note.color,
            opacity: 0.55,
          }}
          className="absolute rounded-[2px]"
        />
      ))}
    </span>
  );
}

function BoardArt({ card }: { card: boolean }) {
  return (
    <span className="flex h-full w-full items-stretch gap-[3px] p-1.5">
      {[3, 2, 1].map((rows, column) => (
        <span key={column} className="flex flex-1 flex-col gap-[3px]">
          {Array.from({ length: rows }, (_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-[2px] bg-k-black-16",
                card ? "h-2.5" : "h-1.5",
              )}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

function ChatArt({ card }: { card: boolean }) {
  return (
    <span className="flex h-full w-full flex-col justify-center gap-[3px] px-1.5">
      <span
        className={cn(
          "self-start rounded-[3px] bg-k-black-16",
          card ? "h-3 w-[62%]" : "h-1.5 w-[70%]",
        )}
      />
      <span
        className={cn(
          "self-end rounded-[3px] bg-k-blue-20",
          card ? "h-3 w-[48%]" : "h-1.5 w-[55%]",
        )}
      />
      <span
        className={cn(
          "self-start rounded-[3px] bg-k-black-16",
          card ? "h-3 w-[40%]" : "h-1.5 w-[45%]",
        )}
      />
    </span>
  );
}
