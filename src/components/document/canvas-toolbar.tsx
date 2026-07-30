"use client";

/**
 * The canvas's two floating controls: the tool rail on the left and the zoom
 * readout on the bottom right.
 *
 * Both are overlays on the board rather than part of the page chrome, because
 * the board is the whole viewport — a toolbar in the page header would be
 * pointing at something a scroll away.
 */
import {
  CircleIcon,
  HandIcon,
  MinusIcon,
  MousePointer2Icon,
  MoveUpRightIcon,
  PlusIcon,
  SquareIcon,
  StickyNoteIcon,
  TypeIcon,
} from "lucide-react";
import { CANVAS_COLORS, CANVAS_COLOR_KEYS, canvasColor } from "@/lib/canvas";
import { cn } from "@/lib/utils";

export type CanvasTool = "select" | "hand" | "note" | "text" | "rect" | "ellipse" | "arrow";

const TOOLS: Array<{ tool: CanvasTool; icon: React.ElementType; label: string; key: string }> = [
  { tool: "select", icon: MousePointer2Icon, label: "Select", key: "V" },
  { tool: "hand", icon: HandIcon, label: "Pan", key: "H" },
  { tool: "note", icon: StickyNoteIcon, label: "Sticky note", key: "N" },
  { tool: "text", icon: TypeIcon, label: "Text", key: "T" },
  { tool: "rect", icon: SquareIcon, label: "Rectangle", key: "R" },
  { tool: "ellipse", icon: CircleIcon, label: "Ellipse", key: "O" },
  { tool: "arrow", icon: MoveUpRightIcon, label: "Arrow", key: "A" },
];

export function CanvasToolRail({
  tool,
  color,
  onTool,
  onColor,
}: {
  tool: CanvasTool;
  /** Colour the next new object gets. */
  color: string;
  onTool: (tool: CanvasTool) => void;
  onColor: (color: string) => void;
}) {
  return (
    <div className="-translate-y-1/2 absolute top-1/2 left-4 z-20 flex flex-col gap-1 rounded-2xl border border-k-black-08 bg-background p-1.5 shadow-popover">
      {TOOLS.map((entry) => (
        <button
          key={entry.tool}
          type="button"
          aria-label={`${entry.label} (${entry.key})`}
          aria-pressed={tool === entry.tool}
          title={`${entry.label} — ${entry.key}`}
          onClick={() => onTool(entry.tool)}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl transition-colors",
            tool === entry.tool
              ? "bg-k-blue text-k-white"
              : "text-k-black-56 hover:bg-k-black-04 hover:text-k-black-84",
          )}
        >
          <entry.icon className="size-[18px]" strokeWidth={1.7} />
        </button>
      ))}

      <div className="my-0.5 border-k-black-06 border-t" />

      <div className="grid grid-cols-2 gap-1 px-0.5 pb-0.5">
        {CANVAS_COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={`${key} objects`}
            aria-pressed={color === key}
            title={key}
            onClick={() => onColor(key)}
            style={{
              background: CANVAS_COLORS[key].note,
              borderColor: color === key ? CANVAS_COLORS[key].stroke : "transparent",
            }}
            className={cn(
              "size-4 rounded-full border-2 transition-transform",
              color === key ? "scale-110" : "hover:scale-110",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function CanvasZoomControls({
  scale,
  onZoom,
  onFit,
}: {
  scale: number;
  onZoom: (delta: number) => void;
  onFit: () => void;
}) {
  return (
    <div className="absolute right-4 bottom-4 z-20 flex items-center gap-0.5 rounded-xl border border-k-black-08 bg-background p-1 shadow-popover">
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => onZoom(-0.2)}
        className="flex size-7 items-center justify-center rounded-lg text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
      >
        <MinusIcon className="size-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={onFit}
        title="Zoom to fit"
        className="min-w-12 rounded-lg px-1.5 py-1 text-center text-k-black-72 text-sm tabular-nums transition-colors hover:bg-k-black-04"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => onZoom(0.2)}
        className="flex size-7 items-center justify-center rounded-lg text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
      >
        <PlusIcon className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}

/**
 * The context toolbar over a selection: recolour, restack, duplicate, delete.
 * Positioned in screen coordinates by the board, which is the only thing that
 * knows where the selection ended up after pan and zoom.
 */
export function CanvasSelectionToolbar({
  x,
  y,
  color,
  onColor,
  onFront,
  onBack,
  onDuplicate,
  onDelete,
}: {
  x: number;
  y: number;
  color: string;
  onColor: (color: string) => void;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{ left: x, top: y }}
      // The toolbar must never take the pointer away from a drag in progress.
      onPointerDown={(e) => e.stopPropagation()}
      className="-translate-x-1/2 absolute z-20 flex items-center gap-1 rounded-xl border border-k-black-08 bg-background p-1 shadow-popover"
    >
      {CANVAS_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={`Colour ${key}`}
          aria-pressed={color === key}
          onClick={() => onColor(key)}
          style={{
            background: canvasColor(key).note,
            borderColor: color === key ? canvasColor(key).stroke : "transparent",
          }}
          className="size-5 rounded-full border-2 transition-transform hover:scale-110"
        />
      ))}

      <span className="mx-0.5 h-5 w-px bg-k-black-08" />

      <ToolbarAction label="Bring to front" onClick={onFront}>
        Front
      </ToolbarAction>
      <ToolbarAction label="Send to back" onClick={onBack}>
        Back
      </ToolbarAction>
      <ToolbarAction label="Duplicate" onClick={onDuplicate}>
        Duplicate
      </ToolbarAction>
      <ToolbarAction label="Delete" onClick={onDelete} destructive>
        Delete
      </ToolbarAction>
    </div>
  );
}

function ToolbarAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-lg px-2 py-1 text-sm transition-colors",
        destructive
          ? "text-k-red hover:bg-k-red-08"
          : "text-k-black-72 hover:bg-k-black-04",
      )}
    >
      {children}
    </button>
  );
}
