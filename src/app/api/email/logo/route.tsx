import { ImageResponse } from "next/og";

/**
 * The brand mark as a PNG, for the header of every outgoing email.
 *
 * A route rather than a file in `public/` because there is no raster master of
 * the mark — the app draws it from paths (`components/brand-mark.tsx`) — and
 * because email can't use the vector one: Gmail strips inline `<svg>` and
 * refuses to render an `.svg` in an `<img>`, so a template that pointed at
 * `icon.svg` would show a broken image to most of its recipients.
 *
 * Reachable while signed out: `proxy.ts` excludes `/api` from its matcher, so
 * Gmail's image proxy (`googleusercontent.com`, which fetches every image in
 * every message with no cookies) isn't bounced to `/sign-in`.
 *
 * Set `EMAIL_LOGO_URL` to override this with a real logo file once one exists;
 * see `lib/email/brand.ts`.
 */
export const runtime = "edge";

/** Rendered at 4× the 24px the template displays it at, for retina inboxes. */
const SIZE = 96;

/**
 * The simplified master — gutter 24/256, no inner fillets. The detailed one
 * loses its 20/256 fillets below ~24px anyway, which is exactly where this
 * renders. See `brand-mark.tsx` for why there are two.
 */
const TILES = [
  "M 116 0 C 51.935 0 0 51.935 0 116 L 116 116 Z",
  "M 140 0 C 204.065 0 256 51.935 256 116 L 140 116 Z",
  "M 116 256 C 51.935 256 0 204.065 0 140 L 116 140 Z",
  "M 140 256 L 256 256 L 256 140 L 140 140 Z",
];

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox="0 0 256 256" fill="#545454">
          {TILES.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: {
        // The mark doesn't change. Gmail caches its proxied copy regardless,
        // but this keeps every other client from refetching per open.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
