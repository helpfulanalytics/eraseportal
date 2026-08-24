"use client";

/**
 * The @-mention autocomplete: a caret-anchored list of the conversation's
 * current participants, filtered by whatever's typed after the `@`.
 *
 * Every other composer popover (GifPicker, MoreMenu) anchors to a toolbar
 * button's own box via a `relative` wrapper — there's no such element at a
 * text caret partway through a `<textarea>`. `getCaretCoordinates` works
 * around that with the standard hidden-mirror-div technique: clone the
 * textarea's box/font/whitespace styling onto an offscreen div, insert a
 * marker at the caret index, and read the marker's offset.
 *
 * Scoped to participants only, not the whole org — see kitchen-data.ts's
 * `parseInline`, which only turns `@handle` into a real mention when the
 * handle belongs to a participant. This list and that resolution have to
 * stay in sync, which is why both start from the same `participantIds`.
 */
import { useEffect, useRef } from "react";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import type { Person } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/** Properties that affect text layout and therefore have to match exactly. */
const MIRRORED_PROPERTIES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "whiteSpace",
  "wordWrap",
] as const;

export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  index: number,
): { top: number; left: number; height: number } {
  const div = document.createElement("div");
  const computed = window.getComputedStyle(textarea);

  for (const prop of MIRRORED_PROPERTIES) {
    div.style[prop] = computed[prop];
  }
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.height = "auto";

  div.textContent = textarea.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(index) || ".";
  div.appendChild(marker);
  document.body.appendChild(div);

  const coords = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: marker.offsetHeight,
  };
  document.body.removeChild(div);
  return coords;
}

export function MentionDropdown({
  people,
  activeIndex,
  style,
  onPick,
  onClose,
}: {
  people: Person[];
  activeIndex: number;
  style: React.CSSProperties;
  onPick: (person: Person) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  if (people.length === 0) return null;

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Mention someone"
      style={style}
      className="absolute z-30 max-h-56 w-64 overflow-y-auto rounded-xl border border-k-black-08 bg-background p-1.5 shadow-popover"
    >
      {people.map((person, i) => (
        <button
          key={person.id}
          ref={i === activeIndex ? activeRef : undefined}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          // Picking a mention must not blur the textarea — mousedown fires
          // before the click's implicit focus change, so preventing its
          // default there is what keeps focus (and the caret position) put.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(person)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
            i === activeIndex ? "bg-k-black-04" : "hover:bg-k-black-04",
          )}
        >
          <PersonAvatar personId={person.id} className="size-6 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-k-black-84 text-sm">{person.name}</span>
            <span className="block truncate text-k-black-40 text-xs">@{person.handle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
