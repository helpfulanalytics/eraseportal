"use client";

/**
 * The menu behind a block's drag handle: turn into, duplicate, delete.
 *
 * Hand-rolled rather than `ui/dropdown-menu`, for the same reason the slash
 * menu is: Base UI's menu takes focus when it opens, and this menu's whole
 * job is to act on a block whose caret must survive the round trip. It also
 * has to share the handle with dnd-kit's drag activator, which owns the
 * pointer events a `DropdownMenuTrigger` would want.
 */
import { useEffect, useRef } from "react";
import { CopyIcon, Trash2Icon } from "lucide-react";
import { BLOCK_TYPES } from "@/components/document/block-types";
import type { DocBlockType } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 220;

export function BlockMenu({
  anchor,
  currentType,
  onTurnInto,
  onDuplicate,
  onDelete,
  onClose,
}: {
  /** Viewport rect of the handle the menu hangs off. */
  anchor: { x: number; y: number };
  currentType: DocBlockType;
  onTurnInto: (type: DocBlockType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
    // `pointerdown` rather than `click`: a click that starts inside the menu
    // and ends outside shouldn't count as dismissing it.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const top = Math.min(anchor.y, window.innerHeight - 380);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Block options"
      style={{ width: MENU_WIDTH, left: Math.max(12, anchor.x), top: Math.max(12, top) }}
      className="fixed z-50 rounded-xl border border-k-black-08 bg-background p-1.5 shadow-popover"
    >
      <div className="px-2 py-1.5 text-k-black-40 text-xs uppercase tracking-wider">
        Turn into
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {BLOCK_TYPES.map((spec) => (
          <button
            key={spec.type}
            type="button"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onTurnInto(spec.type)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-k-black-84 text-md transition-colors hover:bg-k-black-04",
              spec.type === currentType && "bg-k-blue-06 text-k-blue",
            )}
          >
            <spec.icon className="size-4 shrink-0" strokeWidth={1.6} />
            <span className="truncate">{spec.label}</span>
          </button>
        ))}
      </div>

      <div className="my-1.5 border-k-black-06 border-t" />

      <button
        type="button"
        role="menuitem"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDuplicate}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-k-black-84 text-md transition-colors hover:bg-k-black-04"
      >
        <CopyIcon className="size-4 shrink-0" strokeWidth={1.6} />
        Duplicate
      </button>
      <button
        type="button"
        role="menuitem"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDelete}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-k-red text-md transition-colors hover:bg-k-red-08"
      >
        <Trash2Icon className="size-4 shrink-0" strokeWidth={1.6} />
        Delete
      </button>
    </div>
  );
}
