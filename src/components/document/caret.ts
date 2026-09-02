/**
 * Selection helpers for the block editor.
 *
 * A `contenteditable` can't be a controlled React input: writing `innerHTML`
 * on every keystroke destroys and rebuilds the text nodes the caret lives in,
 * so the caret jumps to the start of the block on the second character. The
 * editor therefore lets the browser own the DOM inside a block and reads it
 * back — which means every "where is the caret" question has to be asked of
 * the live Selection, here.
 *
 * Browser-only. Every function touches `window`/`document`, so this is
 * imported exclusively from client components.
 */

/** The current range, but only when it's actually inside `el`. */
function rangeIn(el: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  return el.contains(range.commonAncestorContainer) ? range : null;
}

export function caretAtStart(el: HTMLElement): boolean {
  const range = rangeIn(el);
  if (!range) return false;

  const probe = range.cloneRange();
  probe.selectNodeContents(el);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
}

export function caretAtEnd(el: HTMLElement): boolean {
  const range = rangeIn(el);
  if (!range) return false;

  const probe = range.cloneRange();
  probe.selectNodeContents(el);
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().length === 0;
}

/** Caret position as a plain-text offset, which is what merges need. */
export function caretOffset(el: HTMLElement): number {
  const range = rangeIn(el);
  if (!range) return 0;

  const probe = range.cloneRange();
  probe.selectNodeContents(el);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length;
}

/** True when the selection covers more than one character. */
export function hasSelection(el: HTMLElement): boolean {
  const range = rangeIn(el);
  return Boolean(range && !range.collapsed);
}

export function focusAtStart(el: HTMLElement): void {
  focusAtOffset(el, 0);
}

export function focusAtEnd(el: HTMLElement): void {
  focusAtOffset(el, Number.MAX_SAFE_INTEGER);
}

/**
 * Focuses `el` and puts the caret `offset` characters into its text.
 * Clamped, so `MAX_SAFE_INTEGER` means "the end" and a stale offset from
 * before an edit lands somewhere sane instead of throwing.
 */
export function focusAtOffset(el: HTMLElement, offset: number): void {
  el.focus({ preventScroll: true });

  const range = document.createRange();
  let remaining = offset;
  let placed = false;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      range.setStart(node, remaining);
      placed = true;
      break;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  if (!placed) {
    // No text nodes at all (an empty block), or an offset past the end.
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    range.collapse(true);
  }

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  el.scrollIntoView({ block: "nearest" });
}

/**
 * Splits a block at the caret, returning the HTML on each side. Used by
 * Enter: the block keeps `before`, and a new block below gets `after`.
 *
 * Returns `null` when the caret isn't in this block, which the caller reads
 * as "just append an empty block".
 */
export function splitAtCaret(el: HTMLElement): { before: string; after: string } | null {
  const range = rangeIn(el);
  if (!range) return null;

  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);

  const after = range.cloneRange();
  after.selectNodeContents(el);
  after.setStart(range.endContainer, range.endOffset);

  return { before: fragmentHtml(before), after: fragmentHtml(after) };
}

function fragmentHtml(range: Range): string {
  const holder = document.createElement("div");
  holder.appendChild(range.cloneContents());
  return holder.innerHTML;
}

/**
 * Where to draw the slash menu. A collapsed range in an empty block has no
 * client rect of its own, so fall back to the element that contains it.
 */
export function caretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0).cloneRange();
  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0];

  const node = range.startContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  return el?.getBoundingClientRect() ?? null;
}

/**
 * Applies inline formatting to the current selection.
 *
 * `execCommand` is deprecated and unlikely to ever be removed — the whole
 * web's rich-text tooling depends on it, and the Editing API meant to replace
 * it never shipped. Reimplementing bold-across-a-partial-selection by hand
 * means range surgery on arbitrary nested inline markup, which is a far worse
 * bet than a deprecated-but-universally-implemented call.
 */
export function applyInlineFormat(command: "bold" | "italic" | "underline"): void {
  document.execCommand(command);
}

/** Inserts a hard line break at the caret — Shift+Enter, and Enter in code. */
export function insertLineBreak(): void {
  document.execCommand("insertLineBreak");
}

/** Inserts plain text at the caret, replacing any selection. */
export function insertPlainText(text: string): void {
  document.execCommand("insertText", false, text);
}

/** Turns the current selection into a link — the manual, "select text and link it" path. */
export function applyLink(url: string): void {
  document.execCommand("createLink", false, url);
}

/**
 * Wraps the word ending `url.length` characters before the caret in a link,
 * then restores the caret to where it was (just after the trailing space
 * that triggered this). Used to auto-link a URL as it's typed — same
 * execCommand approach as `applyInlineFormat`, just with a synthetic
 * selection instead of the user's own.
 *
 * `false` on anything that doesn't line up (offset math runs off the end of
 * the block's text nodes) — the URL is simply left as plain text rather than
 * risking a mangled range.
 */
export function autolinkWordBeforeCaret(el: HTMLElement, url: string): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const caret = caretOffset(el);
  const start = caret - 1 - url.length; // -1 for the trailing space just typed
  if (start < 0) return false;

  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let pos = 0;
  let startSet = false;

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (!startSet && pos + length >= start) {
      range.setStart(node, start - pos);
      startSet = true;
    }
    if (startSet && pos + length >= start + url.length) {
      range.setEnd(node, start + url.length - pos);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("createLink", false, url);
      focusAtOffset(el, caret);
      return true;
    }
    pos += length;
    node = walker.nextNode();
  }

  return false;
}
