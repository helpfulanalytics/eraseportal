"use client";

/**
 * The "/" block picker.
 *
 * Stateless on purpose: the caret is still in the block, so the block's own
 * `keydown` handler is the only place that sees Arrow/Enter/Escape. The
 * editor owns `activeIndex` and this just draws it — moving the selection
 * state in here would mean stealing focus, and stealing focus from a
 * `contenteditable` loses the caret.
 */
import { useEffect, useRef } from "react";
import type { BlockTypeSpec } from "@/components/document/block-types";
import type { DocBlockType } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 280;
const MAX_HEIGHT = 300;

export function SlashMenu({
  options,
  activeIndex,
  anchor,
  onChoose,
}: {
  options: BlockTypeSpec[];
  activeIndex: number;
  /** Viewport coordinates of the caret, from `caretRect()`. */
  anchor: { x: number; y: number; bottom: number };
  onChoose: (type: DocBlockType) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation happens in the block, so the menu has to follow the
  // index it's handed rather than a focus ring it owns.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (options.length === 0) return null;

  // Flip above the caret when there isn't room below, and keep the panel
  // inside the viewport horizontally.
  const spaceBelow = window.innerHeight - anchor.bottom;
  const above = spaceBelow < MAX_HEIGHT + 24;
  const left = Math.min(anchor.x, window.innerWidth - MENU_WIDTH - 16);

  return (
    <div
      role="listbox"
      aria-label="Block type"
      style={{
        width: MENU_WIDTH,
        maxHeight: MAX_HEIGHT,
        left: Math.max(16, left),
        top: above ? undefined : anchor.bottom + 6,
        bottom: above ? window.innerHeight - anchor.y + 6 : undefined,
      }}
      className="fixed z-50 overflow-y-auto rounded-xl border border-k-black-08 bg-background p-1.5 shadow-popover"
    >
      <div className="px-2 py-1.5 text-k-black-40 text-xs uppercase tracking-wider">
        Blocks
      </div>
      {options.map((option, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={option.type}
            ref={active ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={active}
            // The caret is in the block behind this menu; a mousedown here
            // would blur it and close the menu before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChoose(option.type)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
              active ? "bg-k-black-04" : "hover:bg-k-black-03",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-k-black-08 text-k-black-72">
              <option.icon className="size-4" strokeWidth={1.6} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-k-black-84 text-md">
                {option.label}
              </span>
              <span className="block truncate text-k-black-40 text-sm">
                {option.hint}
              </span>
            </span>
            {option.markdown ? (
              <span className="shrink-0 font-mono text-k-black-24 text-sm">
                {option.markdown}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
