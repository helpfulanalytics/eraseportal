/**
 * Page-document helpers: block identity, HTML sanitisation, and the legacy
 * `Block[]` → `DocBlock[]` migration.
 *
 * Pure — no data access, no `firebase-admin` — because both sides need it.
 * The editor is a client component and sanitises what it stores locally; the
 * save action re-sanitises the same payload on the server, which is the copy
 * that actually matters. A server action is a public POST endpoint, so the
 * client-side pass is a convenience, never the boundary.
 */
import type { Block, DocBlock, DocBlockType, Inline, KDocument } from "./kitchen-types";
import type { DocumentKind } from "./kitchen-types";

/**
 * Firestore's hard ceiling is 1 MB per document. These caps sit well under
 * it while still being far more than any real page: 2 000 blocks of 20 000
 * characters would be an absurd document, and a rejected save is a much
 * better failure than a document that can never be written again.
 */
export const MAX_BLOCKS = 2000;
export const MAX_BLOCK_HTML = 20_000;

/** Inline tags a block may keep. Everything else is unwrapped to its text. */
const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "code", "a", "br"]);

/** Tags with no closing partner — never pushed onto the balance stack. */
const VOID_TAGS = new Set(["br"]);

const MAX_TAG_DEPTH = 8;

const BLOCK_TYPES: readonly DocBlockType[] = [
  "text",
  "h1",
  "h2",
  "h3",
  "bullet",
  "numbered",
  "todo",
  "quote",
  "code",
  "divider",
];

export function isDocBlockType(value: unknown): value is DocBlockType {
  return typeof value === "string" && (BLOCK_TYPES as readonly string[]).includes(value);
}

/**
 * Ids only have to be unique within one document and stable across a render,
 * which is what React keys and caret restoration need. `crypto.randomUUID`
 * exists in every browser this app supports and in Node 19+, so both the
 * editor and the seed path can call it.
 */
export function newBlockId(): string {
  return `blk_${crypto.randomUUID().slice(0, 12)}`;
}

export function emptyBlock(type: DocBlockType = "text"): DocBlock {
  return { id: newBlockId(), type, html: "" };
}

/** Documents predating the canvas have no `docKind`; they're all pages. */
export function documentKind(doc: Pick<KDocument, "docKind">): DocumentKind {
  return doc.docKind === "canvas" ? "canvas" : "page";
}

/**
 * The body to open in the editor: `content` when the document has been saved
 * at least once, otherwise the legacy `blocks` converted forward. Always
 * returns at least one block, because an editor with nothing to focus has
 * nowhere to put the caret.
 */
export function docBlocksOf(
  doc: Pick<KDocument, "content" | "blocks">,
): DocBlock[] {
  const blocks = doc.content?.length
    ? sanitizeDocBlocks(doc.content)
    : fromLegacyBlocks(doc.blocks ?? []);
  return blocks.length ? blocks : [emptyBlock()];
}

/* ---- legacy conversion ------------------------------------------------ */

/**
 * Converts a message-shaped body into editor blocks. A `ul` becomes one
 * `bullet` block per item — the editor's block list is flat, so a list is
 * consecutive sibling blocks rather than a container.
 *
 * @mentions degrade to `@<personId>` text. Resolving them to handles would
 * need the people map, which this module deliberately can't reach; the only
 * documents that carry mentions are seeded ones, and the conversion is
 * one-way and one-time.
 */
export function fromLegacyBlocks(blocks: Block[]): DocBlock[] {
  const out: DocBlock[] = [];

  for (const block of blocks) {
    if (block.b === "p") {
      out.push({ id: newBlockId(), type: "text", html: inlineToHtml(block.children) });
      continue;
    }
    if (block.b === "ul") {
      for (const item of block.items) {
        out.push({ id: newBlockId(), type: "bullet", html: inlineToHtml(item.children) });
      }
      continue;
    }
    out.push({ id: newBlockId(), type: "code", html: escapeText(block.v) });
  }

  return out;
}

function inlineToHtml(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.t === "mention") return escapeText(`@${node.personId}`);
      if (node.t === "link") {
        const href = safeHref(node.href);
        const label = escapeText(node.v ?? node.href);
        return href ? `<a href="${escapeText(href)}">${label}</a>` : label;
      }
      const text = escapeText(node.v);
      if (node.bold) return `<b>${text}</b>`;
      if (node.italic) return `<i>${text}</i>`;
      return text;
    })
    .join("");
}

/* ---- sanitisation ----------------------------------------------------- */

/**
 * Reduces a `contenteditable`'s output to the inline subset a block may
 * store. Unknown tags are dropped but their text is kept, unbalanced tags
 * are closed, and `href`s are restricted to http(s), mailto and same-site
 * paths — a `javascript:` URL in a shared document would otherwise be stored
 * XSS.
 *
 * Written as a scanner rather than a regex chain, and rather than a DOM
 * parse, because it has to produce identical output on the server (no DOM)
 * and in the browser.
 */
export function sanitizeInlineHtml(input: string): string {
  const source = input.slice(0, MAX_BLOCK_HTML);
  const open: string[] = [];
  let out = "";
  let i = 0;

  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      out += escapeText(decodeEntities(source.slice(i)));
      break;
    }

    out += escapeText(decodeEntities(source.slice(i, lt)));

    const gt = source.indexOf(">", lt);
    if (gt === -1) {
      // A stray "<" with no closing bracket is text, not a tag.
      out += escapeText(decodeEntities(source.slice(lt)));
      break;
    }

    const raw = source.slice(lt + 1, gt);
    i = gt + 1;

    const closing = raw.startsWith("/");
    const name = (closing ? raw.slice(1) : raw)
      .trim()
      .split(/[\s/>]/, 1)[0]
      .toLowerCase();

    if (!ALLOWED_TAGS.has(name)) continue;

    if (VOID_TAGS.has(name)) {
      if (!closing) out += "<br>";
      continue;
    }

    if (closing) {
      // Only close a tag that is actually open, and unwind anything opened
      // inside it so the output stays well-formed.
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      for (let d = open.length - 1; d >= at; d--) out += `</${open[d]}>`;
      open.length = at;
      continue;
    }

    if (open.length >= MAX_TAG_DEPTH) continue;

    if (name === "a") {
      const href = safeHref(attribute(raw, "href"));
      if (!href) continue;
      out += `<a href="${escapeText(href)}">`;
      open.push("a");
      continue;
    }

    out += `<${name}>`;
    open.push(name);
  }

  for (let d = open.length - 1; d >= 0; d--) out += `</${open[d]}>`;

  return collapseEmptyTags(out).slice(0, MAX_BLOCK_HTML);
}

/**
 * Validates one stored block. Anything unrecognised becomes an empty text
 * block rather than being dropped, so a malformed payload can't silently
 * shorten someone's document.
 */
export function sanitizeDocBlock(input: unknown): DocBlock {
  const raw = (input ?? {}) as Partial<DocBlock>;
  const type = isDocBlockType(raw.type) ? raw.type : "text";
  const block: DocBlock = {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 64) : newBlockId(),
    type,
    // A divider has no text of its own, and a code block is literal — neither
    // should carry inline markup.
    html:
      type === "divider"
        ? ""
        : type === "code"
          ? escapeText(decodeEntities(stripTags(String(raw.html ?? "")))).slice(0, MAX_BLOCK_HTML)
          : sanitizeInlineHtml(String(raw.html ?? "")),
  };

  // Firestore rejects `undefined`, so `checked` is set only when it applies.
  if (type === "todo") block.checked = raw.checked === true;

  return block;
}

export function sanitizeDocBlocks(input: unknown): DocBlock[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  return input.slice(0, MAX_BLOCKS).map((entry) => {
    const block = sanitizeDocBlock(entry);
    // Duplicate ids would collide as React keys and make caret restoration
    // land on the wrong block.
    if (seen.has(block.id)) block.id = newBlockId();
    seen.add(block.id);
    return block;
  });
}

/* ---- text helpers ----------------------------------------------------- */

/** Visible text of a block — used for placeholders, search and markdown shortcuts. */
export function plainText(html: string): string {
  return decodeEntities(stripTags(html.replace(/<br\s*\/?>/gi, "\n")));
}

/** First line of visible text in the document, for previews. */
export function docPreview(blocks: DocBlock[]): string {
  for (const block of blocks) {
    const text = plainText(block.html).trim();
    if (text) return text;
  }
  return "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Decodes the handful of entities a `contenteditable` actually emits (mostly
 * `&nbsp;`, which Chrome inserts for every second space) plus numeric ones.
 * Decoding and then re-escaping is what keeps `sanitizeInlineHtml`
 * idempotent — escaping alone would turn `&amp;` into `&amp;amp;` on every
 * save.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " ",
    };
    const key = body.toLowerCase();
    if (key in named) return named[key];
    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });
}

function attribute(rawTag: string, name: string): string {
  const match = rawTag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  if (!match) return "";
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
}

/**
 * http(s), mailto and same-site paths only. Anything else — `javascript:`,
 * `data:`, a protocol-relative `//evil.example` — is refused rather than
 * rewritten, and the link degrades to plain text.
 */
export function safeHref(href: string | undefined): string | null {
  const value = (href ?? "").trim();
  if (!value) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/") || value.startsWith("#")) return value.slice(0, 2048);
  if (/^(https?:|mailto:)/i.test(value)) return value.slice(0, 2048);
  // A bare "example.com/path" typed into the link field is the common case.
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`.slice(0, 2048);
  return null;
}

/**
 * Chrome leaves `<b></b>` behind whenever formatting is toggled on and then
 * off without typing. Harmless to render, but they accumulate in the stored
 * HTML and make two identical-looking blocks compare unequal, which would
 * fire a pointless autosave on every focus change.
 */
function collapseEmptyTags(html: string): string {
  let previous = "";
  let out = html;
  while (out !== previous) {
    previous = out;
    out = out.replace(/<(b|strong|i|em|u|s|code|a)(\s[^>]*)?><\/\1>/g, "");
  }
  return out;
}
