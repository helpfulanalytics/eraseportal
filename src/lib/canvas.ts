/**
 * Canvas-document helpers: the sticky-note palette, geometry, and the
 * server-side validation of a saved node list.
 *
 * Pure, for the same reason as `doc-blocks.ts` — the board is a client
 * component, but the save action re-validates everything it sends.
 *
 * Colours are literal hex rather than the `--k-*` tokens the rest of the app
 * uses. Those tokens are chrome (a 6%-black hairline, a blue accent); a
 * sticky note's yellow is *content*, the same way a folder's cover image is,
 * and the palette needs six distinguishable fills that the token set simply
 * doesn't contain.
 */
import type { CanvasNode, CanvasNodeKind } from "./kitchen-types";

export interface CanvasPalette {
  /** Sticky-note fill. */
  note: string;
  /** Shape fill — the same hue, much lighter, so text stays readable. */
  shape: string;
  /** Border, arrow stroke, and selected-shape outline. */
  stroke: string;
  /** Text colour on both fills. */
  ink: string;
}

export const CANVAS_COLORS: Record<string, CanvasPalette> = {
  yellow: { note: "#ffe8a8", shape: "#fff6d9", stroke: "#dbb44e", ink: "#463608" },
  green: { note: "#c9efd2", shape: "#e8f8ec", stroke: "#5fb37e", ink: "#123522" },
  blue: { note: "#c8e3fb", shape: "#e7f2fe", stroke: "#5b9fdd", ink: "#0d2c4a" },
  purple: { note: "#ded5fb", shape: "#f0ecfe", stroke: "#8f7ce4", ink: "#241953" },
  pink: { note: "#fbd1e0", shape: "#feebf1", stroke: "#e07aa2", ink: "#490f26" },
  gray: { note: "#e5e5e3", shape: "#f3f3f1", stroke: "#adada9", ink: "#2a2a28" },
};

export const CANVAS_COLOR_KEYS = Object.keys(CANVAS_COLORS);

export const DEFAULT_CANVAS_COLOR = "yellow";

export function canvasColor(key: string | undefined): CanvasPalette {
  return CANVAS_COLORS[key ?? ""] ?? CANVAS_COLORS[DEFAULT_CANVAS_COLOR];
}

/** Size a click-placed node gets, in world units. Dragging overrides it. */
export const DEFAULT_NODE_SIZE: Record<CanvasNodeKind, { w: number; h: number }> = {
  note: { w: 180, h: 180 },
  text: { w: 220, h: 40 },
  rect: { w: 200, h: 130 },
  ellipse: { w: 180, h: 140 },
  arrow: { w: 180, h: 0 },
};

/** Below this, a drag reads as a click that meant "place the default size". */
export const DRAG_TO_SIZE_THRESHOLD = 12;

export const MIN_NODE_SIZE = 24;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

/**
 * Caps, for the same 1 MB Firestore ceiling as `MAX_BLOCKS`. A world larger
 * than ±100 000 is also refused: a runaway drag with a broken transform can
 * otherwise write a node at 1e12 and make the board impossible to fit on
 * screen again.
 */
export const MAX_NODES = 1500;
export const MAX_NODE_TEXT = 5000;
const WORLD_LIMIT = 100_000;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Positive-size rect from any two corners. */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/**
 * The rect a node occupies on screen. An arrow stores a vector, so its
 * `w`/`h` may be negative and only its bounds are meaningful for selection
 * and marquee tests.
 */
export function nodeBounds(node: CanvasNode): Rect {
  if (node.kind === "arrow") {
    return rectFromPoints(
      { x: node.x, y: node.y },
      { x: node.x + node.w, y: node.y + node.h },
    );
  }
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Union of every node's bounds — what "zoom to fit" frames. */
export function boundsOf(nodes: CanvasNode[]): Rect | null {
  if (!nodes.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const b = nodeBounds(node);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ---- validation ------------------------------------------------------- */

const NODE_KINDS: readonly CanvasNodeKind[] = ["note", "text", "rect", "ellipse", "arrow"];

function isNodeKind(value: unknown): value is CanvasNodeKind {
  return typeof value === "string" && (NODE_KINDS as readonly string[]).includes(value);
}

function finite(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, Math.round(n * 100) / 100));
}

/**
 * Validates one node from a save payload. Like `sanitizeDocBlock`, an
 * unrecognised entry is coerced rather than dropped — silently losing an
 * object off someone's board is a worse failure than one that comes back
 * as a plain sticky note.
 */
export function sanitizeCanvasNode(input: unknown, index: number): CanvasNode {
  const raw = (input ?? {}) as Partial<CanvasNode>;
  const kind = isNodeKind(raw.kind) ? raw.kind : "note";
  const isArrow = kind === "arrow";

  const node: CanvasNode = {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 64) : `cn_${index}`,
    kind,
    x: finite(raw.x),
    y: finite(raw.y),
    // Only an arrow may have a negative or zero dimension; everything else is
    // a rect that has to stay grabbable.
    w: isArrow ? finite(raw.w) : Math.max(MIN_NODE_SIZE, finite(raw.w, MIN_NODE_SIZE)),
    h: isArrow ? finite(raw.h) : Math.max(MIN_NODE_SIZE, finite(raw.h, MIN_NODE_SIZE)),
    color: typeof raw.color === "string" && raw.color in CANVAS_COLORS
      ? raw.color
      : DEFAULT_CANVAS_COLOR,
  };

  // Canvas text is plain, so it needs no HTML sanitising — it is rendered as
  // a text node, never as markup. Firestore rejects `undefined`, so the key
  // is omitted rather than set empty.
  const text = typeof raw.text === "string" ? raw.text.slice(0, MAX_NODE_TEXT) : "";
  if (text) node.text = text;

  return node;
}

export function sanitizeCanvasNodes(input: unknown): CanvasNode[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  return input.slice(0, MAX_NODES).map((entry, i) => {
    const node = sanitizeCanvasNode(entry, i);
    if (seen.has(node.id)) node.id = `cn_${i}_${node.id}`.slice(0, 64);
    seen.add(node.id);
    return node;
  });
}

export function newNodeId(): string {
  return `cn_${crypto.randomUUID().slice(0, 12)}`;
}
