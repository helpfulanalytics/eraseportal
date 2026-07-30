"use client";

/**
 * The canvas-document editor — a Miro-style infinite whiteboard.
 *
 * The model is deliberately small: a flat, z-ordered array of rectangles
 * (plus arrows, which are vectors) in world coordinates, and a camera that
 * exists only in this component. Nothing about pan or zoom is ever stored, so
 * two people opening the same board see the same objects from wherever they
 * left their own viewport.
 *
 * Pointer handling all runs through one surface with pointer capture rather
 * than per-node listeners or window-level ones: a drag that starts on a
 * sticky note and ends outside the browser window still has to finish
 * cleanly, and capture is what guarantees the `pointerup`.
 *
 * Sizes here are in world units and written as literal pixels, not the app's
 * type scale. A sticky note's text is content that zooms — it is not chrome,
 * and the 14px cap that keeps the UI honest would make a board unreadable at
 * 40%.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveCanvasAction } from "@/app/(workspace)/actions";
import {
  CanvasSelectionToolbar,
  CanvasToolRail,
  CanvasZoomControls,
  type CanvasTool,
} from "@/components/document/canvas-toolbar";
import { SaveStatus } from "@/components/document/save-status";
import { useAutosave } from "@/components/document/use-autosave";
import {
  DEFAULT_CANVAS_COLOR,
  DEFAULT_NODE_SIZE,
  DRAG_TO_SIZE_THRESHOLD,
  MIN_NODE_SIZE,
  boundsOf,
  canvasColor,
  clampZoom,
  newNodeId,
  nodeBounds,
  rectFromPoints,
  rectsIntersect,
  sanitizeCanvasNodes,
  type Rect,
} from "@/lib/canvas";
import type { CanvasNode, CanvasNodeKind } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

type Handle = "nw" | "ne" | "sw" | "se" | "start" | "end";

type Drag =
  | { mode: "pan"; pointer: Point; camera: Point }
  | { mode: "move"; start: Point; origins: Record<string, Point>; moved: boolean }
  | { mode: "create"; kind: CanvasNodeKind; start: Point; current: Point }
  | { mode: "resize"; id: string; handle: Handle; origin: CanvasNode }
  | { mode: "marquee"; start: Point; current: Point };

/** Which tools drop a new object rather than manipulating existing ones. */
const CREATION_TOOL: Partial<Record<CanvasTool, CanvasNodeKind>> = {
  note: "note",
  text: "text",
  rect: "rect",
  ellipse: "ellipse",
  arrow: "arrow",
};

const TOOL_KEYS: Record<string, CanvasTool> = {
  v: "select",
  h: "hand",
  n: "note",
  t: "text",
  r: "rect",
  o: "ellipse",
  a: "arrow",
};

export function CanvasBoard({
  documentId,
  initialNodes,
  editable,
}: {
  documentId: string;
  initialNodes: CanvasNode[];
  editable: boolean;
}) {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [tool, setTool] = useState<CanvasTool>("select");
  const [color, setColor] = useState(DEFAULT_CANVAS_COLOR);
  const [selection, setSelection] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const surfaceRef = useRef<HTMLDivElement>(null);

  // A drag writes to `nodes` on every pointermove and persists once, on
  // pointerup. The handler that runs then must see the *last* move, not the
  // render it happened to be created in.
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  });

  const save = useCallback(
    (value: CanvasNode[]) => saveCanvasAction(documentId, value),
    [documentId],
  );
  const { state: saveState, schedule } = useAutosave(save);

  /**
   * `setNodes` is used freely during a drag — sixty writes a second must not
   * become sixty saves. `commit` is the one that persists, and it's called
   * when a gesture *ends*.
   */
  const commit = useCallback(
    (next: CanvasNode[]) => {
      setNodes(next);
      schedule(sanitizeCanvasNodes(next));
    },
    [schedule],
  );

  /* ---- coordinates ---------------------------------------------------- */

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - camera.x) / camera.scale,
        y: (clientY - rect.top - camera.y) / camera.scale,
      };
    },
    [camera],
  );

  const toScreen = useCallback(
    (point: Point): Point => ({
      x: point.x * camera.scale + camera.x,
      y: point.y * camera.scale + camera.y,
    }),
    [camera],
  );

  /* ---- wheel ---------------------------------------------------------- */

  // Registered natively, not through React's `onWheel`: React attaches wheel
  // listeners passively at the root, so `preventDefault` there is a no-op and
  // the page scrolls behind the board.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el?.getBoundingClientRect();
      if (!rect) return;

      if (e.ctrlKey || e.metaKey) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setCamera((cam) => {
          // Keep the world point under the cursor pinned while scaling.
          const scale = clampZoom(cam.scale * Math.exp(-e.deltaY * 0.0125));
          const wx = (px - cam.x) / cam.scale;
          const wy = (py - cam.y) / cam.scale;
          return { scale, x: px - wx * scale, y: py - wy * scale };
        });
        return;
      }

      setCamera((cam) => ({ ...cam, x: cam.x - e.deltaX, y: cam.y - e.deltaY }));
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---- mutations ------------------------------------------------------ */

  const duplicateSelection = useCallback(() => {
    if (selection.length === 0) return;
    const copies = nodes
      .filter((n) => selection.includes(n.id))
      .map((n) => ({ ...n, id: newNodeId(), x: n.x + 24, y: n.y + 24 }));
    commit([...nodes, ...copies]);
    setSelection(copies.map((c) => c.id));
  }, [commit, nodes, selection]);

  const recolourSelection = useCallback(
    (next: string) => {
      setColor(next);
      if (selection.length === 0) return;
      commit(nodes.map((n) => (selection.includes(n.id) ? { ...n, color: next } : n)));
    },
    [commit, nodes, selection],
  );

  const restack = useCallback(
    (to: "front" | "back") => {
      const moving = nodes.filter((n) => selection.includes(n.id));
      const rest = nodes.filter((n) => !selection.includes(n.id));
      commit(to === "front" ? [...rest, ...moving] : [...moving, ...rest]);
    },
    [commit, nodes, selection],
  );

  const createNode = useCallback(
    (kind: CanvasNodeKind, rect: Rect, vector?: { w: number; h: number }): CanvasNode => ({
      id: newNodeId(),
      kind,
      x: rect.x,
      y: rect.y,
      w: vector ? vector.w : Math.max(MIN_NODE_SIZE, rect.w),
      h: vector ? vector.h : Math.max(MIN_NODE_SIZE, rect.h),
      color,
    }),
    [color],
  );

  /* ---- keyboard ------------------------------------------------------- */

  useEffect(() => {
    function typing(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      return Boolean(
        el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable),
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " " && !typing(e.target)) {
        // Space-drag pans, the way it does in every drawing tool. Held, not
        // toggled, so it can't be left on by accident.
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      if (typing(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (!editable) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        setSelection([]);
        setTool("select");
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.length === 0) return;
        e.preventDefault();
        commit(nodes.filter((n) => !selection.includes(n.id)));
        setSelection([]);
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelection(nodes.map((n) => n.id));
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (!mod && TOOL_KEYS[e.key.toLowerCase()]) {
        setTool(TOOL_KEYS[e.key.toLowerCase()]);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " ") setSpaceHeld(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [commit, duplicateSelection, editable, nodes, selection]);

  /* ---- pointer -------------------------------------------------------- */

  const capture = (e: React.PointerEvent) => {
    surfaceRef.current?.setPointerCapture(e.pointerId);
  };

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const world = toWorld(e.clientX, e.clientY);
    capture(e);
    setEditingId(null);

    // Middle button, the hand tool and space-drag all mean the same thing.
    if (e.button === 1 || tool === "hand" || spaceHeld) {
      setDrag({
        mode: "pan",
        pointer: { x: e.clientX, y: e.clientY },
        camera: { x: camera.x, y: camera.y },
      });
      return;
    }

    if (!editable) return;

    const kind = CREATION_TOOL[tool];
    if (kind) {
      setSelection([]);
      setDrag({ mode: "create", kind, start: world, current: world });
      return;
    }

    if (!e.shiftKey) setSelection([]);
    setDrag({ mode: "marquee", start: world, current: world });
  };

  const onNodePointerDown = (e: React.PointerEvent, node: CanvasNode) => {
    if (!editable || e.button !== 0) return;
    if (tool === "hand" || spaceHeld || CREATION_TOOL[tool]) return; // the surface handles those
    e.stopPropagation();
    capture(e);

    const next = e.shiftKey
      ? selection.includes(node.id)
        ? selection.filter((id) => id !== node.id)
        : [...selection, node.id]
      : selection.includes(node.id)
        ? selection
        : [node.id];
    setSelection(next);
    if (editingId && editingId !== node.id) setEditingId(null);

    const world = toWorld(e.clientX, e.clientY);
    const origins: Record<string, Point> = {};
    for (const n of nodes) {
      if (next.includes(n.id)) origins[n.id] = { x: n.x, y: n.y };
    }
    setDrag({ mode: "move", start: world, origins, moved: false });
  };

  const onHandlePointerDown = (e: React.PointerEvent, node: CanvasNode, handle: Handle) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    capture(e);
    setDrag({ mode: "resize", id: node.id, handle, origin: node });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;

    if (drag.mode === "pan") {
      setCamera((cam) => ({
        ...cam,
        x: drag.camera.x + (e.clientX - drag.pointer.x),
        y: drag.camera.y + (e.clientY - drag.pointer.y),
      }));
      return;
    }

    const world = toWorld(e.clientX, e.clientY);

    if (drag.mode === "move") {
      const dx = world.x - drag.start.x;
      const dy = world.y - drag.start.y;
      setNodes((current) =>
        current.map((n) => {
          const origin = drag.origins[n.id];
          return origin ? { ...n, x: origin.x + dx, y: origin.y + dy } : n;
        }),
      );
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 0.5) {
        setDrag({ ...drag, moved: true });
      }
      return;
    }

    if (drag.mode === "resize") {
      setNodes((current) =>
        current.map((n) => (n.id === drag.id ? resized(drag.origin, drag.handle, world) : n)),
      );
      return;
    }

    setDrag({ ...drag, current: world });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    surfaceRef.current?.releasePointerCapture(e.pointerId);

    if (drag.mode === "pan") {
      setDrag(null);
      return;
    }

    if (drag.mode === "move" || drag.mode === "resize") {
      // The live nodes already hold the result of the gesture; this is the
      // point at which it's worth writing down.
      commit(nodesRef.current);
      setDrag(null);
      return;
    }

    if (drag.mode === "marquee") {
      const rect = rectFromPoints(drag.start, drag.current);
      const hits = nodes.filter((n) => rectsIntersect(nodeBounds(n), rect)).map((n) => n.id);
      setSelection((current) =>
        e.shiftKey ? [...new Set([...current, ...hits])] : hits,
      );
      setDrag(null);
      return;
    }

    // create
    const rect = rectFromPoints(drag.start, drag.current);
    const dragged =
      Math.abs(drag.current.x - drag.start.x) + Math.abs(drag.current.y - drag.start.y) >
      DRAG_TO_SIZE_THRESHOLD;

    let node: CanvasNode;
    if (drag.kind === "arrow") {
      const vector = dragged
        ? { w: drag.current.x - drag.start.x, h: drag.current.y - drag.start.y }
        : { w: DEFAULT_NODE_SIZE.arrow.w, h: DEFAULT_NODE_SIZE.arrow.h };
      node = createNode("arrow", { x: drag.start.x, y: drag.start.y, w: 0, h: 0 }, vector);
    } else if (dragged) {
      node = createNode(drag.kind, rect);
    } else {
      // A plain click drops the default size centred on the click, which is
      // where someone pointing at a spot expects the object to land.
      const size = DEFAULT_NODE_SIZE[drag.kind];
      node = createNode(drag.kind, {
        x: drag.start.x - size.w / 2,
        y: drag.start.y - size.h / 2,
        w: size.w,
        h: size.h,
      });
    }

    commit([...nodes, node]);
    setSelection([node.id]);
    setDrag(null);
    setTool("select");
    // Notes and text exist to be typed in — go straight into the text.
    if (node.kind === "note" || node.kind === "text") setEditingId(node.id);
  };

  /* ---- zoom controls -------------------------------------------------- */

  const zoomBy = useCallback((delta: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    setCamera((cam) => {
      const scale = clampZoom(cam.scale + delta * cam.scale);
      const wx = (px - cam.x) / cam.scale;
      const wy = (py - cam.y) / cam.scale;
      return { scale, x: px - wx * scale, y: py - wy * scale };
    });
  }, []);

  const fit = useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const bounds = boundsOf(nodes);
    if (!rect || !bounds || bounds.w === 0 || bounds.h === 0) {
      setCamera({ x: 0, y: 0, scale: 1 });
      return;
    }
    const padding = 80;
    const scale = clampZoom(
      Math.min(
        (rect.width - padding * 2) / bounds.w,
        (rect.height - padding * 2) / bounds.h,
        1.5,
      ),
    );
    setCamera({
      scale,
      x: rect.width / 2 - (bounds.x + bounds.w / 2) * scale,
      y: rect.height / 2 - (bounds.y + bounds.h / 2) * scale,
    });
  }, [nodes]);

  /* ---- render --------------------------------------------------------- */

  const selectionBounds = useMemo(() => {
    const chosen = nodes.filter((n) => selection.includes(n.id));
    return chosen.length ? boundsOf(chosen) : null;
  }, [nodes, selection]);

  const selectedColor =
    nodes.find((n) => n.id === selection[0])?.color ?? color;

  const marquee =
    drag?.mode === "marquee" ? rectFromPoints(drag.start, drag.current) : null;
  const preview =
    drag?.mode === "create" && drag.kind !== "arrow"
      ? rectFromPoints(drag.start, drag.current)
      : null;
  const previewArrow = drag?.mode === "create" && drag.kind === "arrow" ? drag : null;

  const cursor = spaceHeld || tool === "hand" ? "grab" : CREATION_TOOL[tool] ? "crosshair" : "default";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-end px-5 pb-2">
        <SaveStatus state={saveState} readOnly={!editable} />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={surfaceRef}
          role="application"
          aria-label="Canvas board"
          style={{
            cursor: drag?.mode === "pan" ? "grabbing" : cursor,
            backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
            backgroundImage:
              "radial-gradient(circle, var(--k-black-10) 1px, transparent 1px)",
          }}
          className="absolute inset-0 touch-none overflow-hidden bg-k-gray-f8"
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
            }}
          >
            {nodes.map((node) => (
              <NodeView
                key={node.id}
                node={node}
                editable={editable}
                selected={selection.includes(node.id)}
                soleSelection={selection.length === 1 && selection[0] === node.id}
                editing={editingId === node.id}
                scale={camera.scale}
                onPointerDown={(e) => onNodePointerDown(e, node)}
                onHandlePointerDown={(e, handle) => onHandlePointerDown(e, node, handle)}
                onStartEditing={() => {
                  if (editable && node.kind !== "arrow") setEditingId(node.id);
                }}
                onText={(text) =>
                  commit(nodes.map((n) => (n.id === node.id ? { ...n, text } : n)))
                }
                onStopEditing={() => setEditingId(null)}
              />
            ))}

            {preview ? (
              <div
                style={{
                  left: preview.x,
                  top: preview.y,
                  width: preview.w,
                  height: preview.h,
                  borderRadius: drag?.mode === "create" && drag.kind === "ellipse" ? "50%" : 8,
                }}
                className="pointer-events-none absolute border-2 border-k-blue border-dashed bg-k-blue-06"
              />
            ) : null}

            {previewArrow ? (
              <Arrow
                x1={previewArrow.start.x}
                y1={previewArrow.start.y}
                x2={previewArrow.current.x}
                y2={previewArrow.current.y}
                color="var(--k-blue)"
                dashed
              />
            ) : null}
          </div>

          {marquee ? (
            <div
              style={{
                left: toScreen(marquee).x,
                top: toScreen(marquee).y,
                width: marquee.w * camera.scale,
                height: marquee.h * camera.scale,
              }}
              className="pointer-events-none absolute rounded-sm border border-k-blue bg-k-blue-08"
            />
          ) : null}
        </div>

        {editable ? (
          <CanvasToolRail
            tool={tool}
            color={color}
            onTool={(next) => {
              setTool(next);
              setEditingId(null);
            }}
            onColor={recolourSelection}
          />
        ) : null}

        <CanvasZoomControls scale={camera.scale} onZoom={zoomBy} onFit={fit} />

        {editable && selectionBounds && !drag ? (
          <CanvasSelectionToolbar
            x={toScreen({ x: selectionBounds.x + selectionBounds.w / 2, y: 0 }).x}
            y={Math.max(8, toScreen({ x: 0, y: selectionBounds.y }).y - 48)}
            color={selectedColor}
            onColor={recolourSelection}
            onFront={() => restack("front")}
            onBack={() => restack("back")}
            onDuplicate={duplicateSelection}
            onDelete={() => {
              commit(nodes.filter((n) => !selection.includes(n.id)));
              setSelection([]);
            }}
          />
        ) : null}

        {nodes.length === 0 && editable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-k-black-36 text-md">
              Pick a tool on the left, then click the canvas. Scroll to pan,
              ⌘-scroll to zoom.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---- one object -------------------------------------------------------- */

function NodeView({
  node,
  editable,
  selected,
  soleSelection,
  editing,
  scale,
  onPointerDown,
  onHandlePointerDown,
  onStartEditing,
  onStopEditing,
  onText,
}: {
  node: CanvasNode;
  editable: boolean;
  selected: boolean;
  soleSelection: boolean;
  editing: boolean;
  scale: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onHandlePointerDown: (e: React.PointerEvent, handle: Handle) => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onText: (text: string) => void;
}) {
  const palette = canvasColor(node.color);
  const bounds = nodeBounds(node);

  if (node.kind === "arrow") {
    return (
      <>
        <Arrow
          x1={node.x}
          y1={node.y}
          x2={node.x + node.w}
          y2={node.y + node.h}
          color={palette.stroke}
          selected={selected}
          onPointerDown={onPointerDown}
        />
        {soleSelection && editable ? (
          <>
            <ResizeHandle
              x={node.x}
              y={node.y}
              scale={scale}
              onPointerDown={(e) => onHandlePointerDown(e, "start")}
            />
            <ResizeHandle
              x={node.x + node.w}
              y={node.y + node.h}
              scale={scale}
              onPointerDown={(e) => onHandlePointerDown(e, "end")}
            />
          </>
        ) : null}
      </>
    );
  }

  const isNote = node.kind === "note";
  const isText = node.kind === "text";

  return (
    <>
      {/*
        The board itself is the `role="application"` surface that owns the
        keyboard; an object is a target within it, not a control of its own.
      */}
      <div
        role="presentation"
        data-canvas-node={node.id}
        onPointerDown={onPointerDown}
        onDoubleClick={onStartEditing}
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.w,
          height: bounds.h,
          background: isText ? "transparent" : isNote ? palette.note : palette.shape,
          borderColor: isText ? "transparent" : palette.stroke,
          borderRadius: node.kind === "ellipse" ? "50%" : isNote ? 4 : 10,
          color: palette.ink,
          boxShadow: isNote ? "0 2px 6px rgba(0,0,0,0.12)" : undefined,
        }}
        className={cn(
          "absolute flex items-center justify-center overflow-hidden p-3",
          isText ? "border-0" : "border-2",
          editable && "cursor-move",
        )}
      >
        {editing ? (
          <textarea
            autoFocus
            value={node.text ?? ""}
            onChange={(e) => onText(e.target.value)}
            onBlur={onStopEditing}
            // Stops the surface from reading this as the start of a marquee.
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              fontSize: isText ? 20 : 16,
              lineHeight: 1.35,
              color: palette.ink,
              textAlign: isText ? "left" : "center",
            }}
            className="size-full resize-none bg-transparent outline-none"
          />
        ) : (
          <span
            style={{
              fontSize: isText ? 20 : 16,
              lineHeight: 1.35,
              textAlign: isText ? "left" : "center",
            }}
            className="pointer-events-none size-full select-none overflow-hidden whitespace-pre-wrap break-words"
          >
            {node.text ?? ""}
          </span>
        )}
      </div>

      {selected ? (
        <div
          style={{
            left: bounds.x,
            top: bounds.y,
            width: bounds.w,
            height: bounds.h,
            outlineWidth: 2 / scale,
            outlineOffset: 2 / scale,
            borderRadius: node.kind === "ellipse" ? "50%" : 10,
          }}
          className="pointer-events-none absolute outline outline-k-blue"
        />
      ) : null}

      {soleSelection && editable ? (
        <>
          <ResizeHandle x={bounds.x} y={bounds.y} scale={scale} onPointerDown={(e) => onHandlePointerDown(e, "nw")} />
          <ResizeHandle x={bounds.x + bounds.w} y={bounds.y} scale={scale} onPointerDown={(e) => onHandlePointerDown(e, "ne")} />
          <ResizeHandle x={bounds.x} y={bounds.y + bounds.h} scale={scale} onPointerDown={(e) => onHandlePointerDown(e, "sw")} />
          <ResizeHandle
            x={bounds.x + bounds.w}
            y={bounds.y + bounds.h}
            scale={scale}
            onPointerDown={(e) => onHandlePointerDown(e, "se")}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * Handles keep a constant *screen* size, so they stay grabbable at 30% zoom
 * and don't swallow a small note at 300%.
 */
function ResizeHandle({
  x,
  y,
  scale,
  onPointerDown,
}: {
  x: number;
  y: number;
  scale: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const size = 10 / scale;
  return (
    <div
      role="presentation"
      onPointerDown={onPointerDown}
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderWidth: 1.5 / scale,
        borderRadius: 2 / scale,
      }}
      className="absolute cursor-nwse-resize border-k-blue bg-background"
    />
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  color,
  selected,
  dashed,
  onPointerDown,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  selected?: boolean;
  dashed?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 14;
  const spread = Math.PI / 7;
  const tip = `${x2},${y2}`;
  const left = `${x2 - head * Math.cos(angle - spread)},${y2 - head * Math.sin(angle - spread)}`;
  const right = `${x2 - head * Math.cos(angle + spread)},${y2 - head * Math.sin(angle + spread)}`;

  return (
    // Zero-sized and `overflow: visible`: the SVG is only a coordinate space,
    // so it never covers the objects around it and never eats their clicks.
    <svg
      width="1"
      height="1"
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      className="pointer-events-none"
      aria-hidden="true"
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={selected ? 4 : 3}
        strokeLinecap="round"
        strokeDasharray={dashed ? "6 6" : undefined}
      />
      <polygon points={`${tip} ${left} ${right}`} fill={color} />
      {onPointerDown ? (
        // A 3px line is almost impossible to hit; this invisible one is the
        // actual target.
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="transparent"
          strokeWidth={18}
          className="pointer-events-auto cursor-move"
          onPointerDown={onPointerDown}
        />
      ) : null}
    </svg>
  );
}

/* ---- geometry ---------------------------------------------------------- */

/** Applies a resize handle drag, keeping the opposite corner pinned. */
function resized(origin: CanvasNode, handle: Handle, world: Point): CanvasNode {
  if (handle === "start") {
    return {
      ...origin,
      x: world.x,
      y: world.y,
      w: origin.x + origin.w - world.x,
      h: origin.y + origin.h - world.y,
    };
  }
  if (handle === "end") {
    return { ...origin, w: world.x - origin.x, h: world.y - origin.y };
  }

  const right = origin.x + origin.w;
  const bottom = origin.y + origin.h;
  const anchor = {
    x: handle === "nw" || handle === "sw" ? right : origin.x,
    y: handle === "nw" || handle === "ne" ? bottom : origin.y,
  };
  const rect = rectFromPoints(anchor, world);

  return {
    ...origin,
    x: rect.w < MIN_NODE_SIZE && world.x > anchor.x ? anchor.x : rect.x,
    y: rect.h < MIN_NODE_SIZE && world.y > anchor.y ? anchor.y : rect.y,
    w: Math.max(MIN_NODE_SIZE, rect.w),
    h: Math.max(MIN_NODE_SIZE, rect.h),
  };
}
