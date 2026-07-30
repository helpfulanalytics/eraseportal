"use server";

/**
 * The composer's GIF search, proxied so `GIPHY_API_KEY` stays on the server.
 *
 * Reads, not mutations, so it lives beside `inbox-actions.ts` rather than in
 * `actions.ts` — that file's contract is "every export mutates and takes its
 * actor from the session", and a fetch in it would weaken the rule that makes
 * it easy to audit.
 *
 * Still requires a signed-in caller: a server action is a public endpoint,
 * and an open one here would be a free GIPHY proxy spending this project's
 * rate limit for anyone who found it.
 */
import { getCurrentUser } from "@/lib/kitchen-data";
import { isGiphyConfigured, searchGiphy, type GiphyGif } from "@/lib/giphy";

export interface GiphyResult {
  /** False when no API key is set — the picker offers a link field instead. */
  configured: boolean;
  gifs: GiphyGif[];
  error?: string;
}

export async function searchGifsAction(query: string): Promise<GiphyResult> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");

  if (!isGiphyConfigured()) return { configured: false, gifs: [] };

  try {
    return { configured: true, gifs: await searchGiphy(query.slice(0, 100)) };
  } catch (cause) {
    console.error("[giphy] search failed:", cause);
    return {
      configured: true,
      gifs: [],
      // GIPHY being down or rate-limiting is not the composer's problem to
      // solve — say so and leave the link field as the way through.
      error: "GIPHY isn't responding. Try again, or paste a link instead.",
    };
  }
}
