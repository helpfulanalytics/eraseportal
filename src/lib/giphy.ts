/**
 * GIPHY search — the composer's GIF picker.
 *
 * **Server-only, deliberately.** GIPHY issues web keys that are meant to sit
 * in browser code, but a key in the bundle is a key anyone can lift and spend
 * this project's rate limit on. Proxying keeps `GIPHY_API_KEY` on the server,
 * costs one hop, and means the browser never talks to giphy.com for anything
 * but the image bytes themselves.
 *
 * Optional, like Resend: nothing here is read at import time, so a clone with
 * no key still builds and runs — `isGiphyConfigured()` lets the picker say so
 * and fall back to pasting a link, rather than failing at the network.
 *
 * GIPHY's terms require visible attribution wherever results are shown. The
 * picker renders it; don't remove it.
 */

const ENDPOINT = "https://api.giphy.com/v1/gifs";

/** Keeps this workspace's results the same as the rest of the product's tone. */
const RATING = "pg-13";

export interface GiphyGif {
  id: string;
  title: string;
  /** Small, animated, for the picker grid. */
  previewUrl: string;
  /** What actually gets attached to the message. */
  url: string;
  width: number;
  height: number;
  /** Bytes of the attached size, 0 when GIPHY doesn't report it. */
  bytes: number;
}

export function isGiphyConfigured(): boolean {
  return Boolean(process.env.GIPHY_API_KEY);
}

/**
 * Search, or trending when the query is empty — which is what an empty picker
 * should show rather than a blank grid.
 */
export async function searchGiphy(
  query: string,
  limit = 24,
): Promise<GiphyGif[]> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return [];

  const trimmed = query.trim();
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(Math.min(limit, 50)),
    rating: RATING,
    bundle: "messaging_non_clips",
  });
  if (trimmed) params.set("q", trimmed);

  const url = `${ENDPOINT}/${trimmed ? "search" : "trending"}?${params}`;

  // Cached for a few minutes: trending barely moves, and the same query
  // typed by two people shouldn't cost two calls against the rate limit.
  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) {
    throw new Error(`GIPHY responded ${response.status}.`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  return (payload.data ?? []).flatMap(toGif);
}

/**
 * GIPHY's payload is wide and loosely typed; this keeps only what the picker
 * and the attachment need, and drops anything missing a usable image rather
 * than rendering a broken tile.
 */
function toGif(raw: unknown): GiphyGif[] {
  const gif = raw as {
    id?: string;
    title?: string;
    images?: Record<string, { url?: string; width?: string; height?: string; size?: string }>;
  };

  const preview = gif.images?.fixed_width_downsampled ?? gif.images?.fixed_width;
  const full = gif.images?.downsized_medium ?? gif.images?.original;
  if (!gif.id || !preview?.url || !full?.url) return [];

  return [
    {
      id: gif.id,
      title: (gif.title || "GIF").trim().slice(0, 120),
      previewUrl: preview.url,
      url: full.url,
      width: Number(preview.width) || 200,
      height: Number(preview.height) || 200,
      bytes: Number(full.size) || 0,
    },
  ];
}
