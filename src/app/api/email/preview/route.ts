import { PREVIEWS, previewGallery, previewHtml, previewText } from "@/lib/email/preview";

/**
 * `next dev` only. Renders every template — see `lib/email/preview.ts` for why
 * this exists at all.
 *
 * 404s in production rather than being auth-gated, because `proxy.ts` doesn't
 * cover `/api` and a dev tool has no business being reachable on the live
 * site even to a signed-in member.
 *
 *   /api/email/preview                       the gallery
 *   /api/email/preview?type=file-uploaded    one email, as the client sees it
 *   /api/email/preview?type=…&format=text    its plain-text alternative
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type) {
    return new Response(previewGallery(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (searchParams.get("format") === "text") {
    const text = previewText(type);
    return text === null
      ? unknownType()
      : new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const html = previewHtml(type);
  return html === null
    ? unknownType()
    : new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function unknownType(): Response {
  return new Response(`Unknown template. Try one of: ${Object.keys(PREVIEWS).join(", ")}`, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
