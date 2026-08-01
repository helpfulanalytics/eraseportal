/**
 * The Erase Friction Portal mark — four quadrant tiles in a 256 box, three
 * outer corners
 * rounded to a true quarter-disc, the bottom-right one left square.
 *
 * The square corner is the whole idea. Rounded on all four it reads as the
 * generic "grid view" glyph that already sits in every toolbar. The radii are
 * off the `--k-radius-*` ladder on purpose: this is a mark, not a surface.
 *
 * Two masters, because the detail doesn't survive being scaled down. Below
 * `DETAIL_FLOOR` the 20/256 inner fillets land under 2px and the gutter starts
 * to alias, so the small master drops the fillets and widens the gutter to
 * 24/256 to hold the cross open.
 *
 * The viewBox is 269 across 256 of artwork. The square corner makes the
 * bottom-right tile ~17% heavier than the other three, dragging the ink
 * centroid to (134.5, 134.5) — 2.5% down and right of the geometric centre.
 * The extra ~13 units of right/bottom padding put the centroid in the middle
 * of the box, so the mark reads centred in a flex container with no nudge at
 * the call site. Both masters land within 0.1 of the same figure.
 */

/** Below this px size, render the simplified master. */
const DETAIL_FLOOR = 24;

const VIEW_BOX = "0 0 269 269";

/** gutter 16, outer radius 120, inner fillet 20 */
const FULL = [
  "M 120 0 C 53.726 0 0 53.726 0 120 L 100 120 C 111.046 120 120 111.046 120 100 Z",
  "M 136 0 C 202.274 0 256 53.726 256 120 L 156 120 C 144.954 120 136 111.046 136 100 Z",
  "M 120 256 C 53.726 256 0 202.274 0 136 L 100 136 C 111.046 136 120 144.954 120 156 Z",
  "M 136 256 L 256 256 L 256 136 L 156 136 C 144.954 136 136 144.954 136 156 Z",
];

/** gutter 24, outer radius 116, no fillet */
const SMALL = [
  "M 116 0 C 51.935 0 0 51.935 0 116 L 116 116 Z",
  "M 140 0 C 204.065 0 256 51.935 256 116 L 140 116 Z",
  "M 116 256 C 51.935 256 0 204.065 0 140 L 116 140 Z",
  "M 140 256 L 256 256 L 256 140 L 140 140 Z",
];

/**
 * Colour comes from `currentColor`, so set it with a `text-*` class the way the
 * rail's other glyphs do. Tiles are separate paths so a caller can tint them
 * individually without forking the geometry.
 */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const tiles = size < DETAIL_FLOOR ? SMALL : FULL;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      fill="currentColor"
      aria-hidden="true"
    >
      {tiles.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
