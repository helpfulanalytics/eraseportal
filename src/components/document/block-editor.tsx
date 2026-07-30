"use client";

/**
 * The page-document editor — a Notion-style stack of blocks.
 *
 * Three rules shape the whole file:
 *
 * 1. **The DOM owns the text; React owns the structure.** Each block's
 *    `contenteditable` is uncontrolled (see `block-row.tsx`), so React state
 *    is only rewritten from the DOM, never the other way round while typing.
 *    Every *structural* change — split, merge, reorder, turn-into — is a
 *    state change, and the caret is restored afterwards by id and character
 *    offset through `focus`.
 * 2. **Nothing is saved by hand.** `useAutosave` debounces, coalesces and
 *    flushes on unmount; the status pill in the header is the only feedback.
 * 3. **The stored HTML is not trusted.** What's in state is whatever the
 *    browser's editing engine produced. It's sanitised on the way out, and
 *    again on the server, which is the copy that counts.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { saveDocumentAction } from "@/app/(workspace)/actions";
import { BlockMenu } from "@/components/document/block-menu";
import { BlockRow } from "@/components/document/block-row";
import {
  MARKDOWN_SHORTCUTS,
  matchBlockTypes,
} from "@/components/document/block-types";
import {
  applyInlineFormat,
  caretAtEnd,
  caretAtStart,
  caretRect,
  focusAtOffset,
  hasSelection,
  insertLineBreak,
  insertPlainText,
  splitAtCaret,
} from "@/components/document/caret";
import { SlashMenu } from "@/components/document/slash-menu";
import { SaveStatus } from "@/components/document/save-status";
import { useAutosave } from "@/components/document/use-autosave";
import { emptyBlock, newBlockId, plainText, sanitizeDocBlocks } from "@/lib/doc-blocks";
import type { DocBlock, DocBlockType } from "@/lib/kitchen-types";

/** Where to put the caret after a structural change. */
interface FocusRequest {
  id: string;
  /** Plain-text offset within the block. */
  offset: number;
}

interface SlashState {
  blockId: string;
  query: string;
  anchor: { x: number; y: number; bottom: number };
  index: number;
}

interface MenuState {
  blockId: string;
  x: number;
  y: number;
}

/** The types that continue themselves when you press Enter at the end. */
const CONTINUING: DocBlockType[] = ["bullet", "numbered", "todo"];

export function BlockEditor({
  documentId,
  initialBlocks,
  editable,
}: {
  documentId: string;
  initialBlocks: DocBlock[];
  editable: boolean;
}) {
  const [blocks, setBlocks] = useState<DocBlock[]>(initialBlocks);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const save = useCallback(
    (value: DocBlock[]) => saveDocumentAction(documentId, value),
    [documentId],
  );
  const { state: saveState, schedule } = useAutosave(save);

  /**
   * Restores the caret after a structural change. `focus` is a fresh object
   * every time, so the effect re-runs even when the same offset in the same
   * block is requested twice — and it is never cleared, which would be a
   * `setState` inside an effect (the project's lint rule rejects that, and
   * there's nothing to clear anyway).
   */
  useLayoutEffect(() => {
    if (!focus) return;
    const el = rootRef.current?.querySelector<HTMLElement>(
      `[data-block-id="${CSS.escape(focus.id)}"] [data-editable="true"]`,
    );
    if (el) focusAtOffset(el, focus.offset);
  }, [focus]);

  const commit = useCallback(
    (next: DocBlock[], nextFocus?: FocusRequest) => {
      setBlocks(next);
      if (nextFocus) setFocus({ ...nextFocus });
      // Sanitise on the way out, not on the way in: cleaning the HTML while
      // someone is mid-word would rewrite the DOM under the caret.
      schedule(sanitizeDocBlocks(next));
    },
    [schedule],
  );

  const sensors = useSensors(
    // A handle that starts dragging on `pointerdown` could never also be a
    // menu button; the distance threshold is what lets it be both.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---- structural helpers -------------------------------------------- */

  const indexOf = useCallback(
    (id: string) => blocks.findIndex((b) => b.id === id),
    [blocks],
  );

  const replaceAt = useCallback(
    (index: number, patch: Partial<DocBlock>): DocBlock[] =>
      blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    [blocks],
  );

  const closeOverlays = useCallback(() => {
    setSlash(null);
    setMenu(null);
  }, []);

  /* ---- typing --------------------------------------------------------- */

  /**
   * Converts a block whose text begins with a markdown prefix, dropping the
   * prefix itself.
   *
   * The prefix is stripped from the HTML when it's there literally, and from
   * the plain text otherwise — Chrome rewrites a trailing space as `&nbsp;`,
   * so `"# "` frequently isn't a substring of the HTML at all. The fallback
   * loses inline formatting in the stripped-away portion, which is a prefix
   * someone just typed and therefore has none.
   */
  const applyMarkdown = useCallback(
    (index: number, type: DocBlockType, prefix: string, html: string, text: string) => {
      const rest = html.startsWith(prefix)
        ? html.slice(prefix.length)
        : escapeHtml(text.slice(prefix.length));

      if (type === "divider") {
        const divider: DocBlock = { id: blocks[index].id, type: "divider", html: "" };
        const after = emptyBlock();
        const next = [
          ...blocks.slice(0, index),
          divider,
          after,
          ...blocks.slice(index + 1),
        ];
        commit(next, { id: after.id, offset: 0 });
        return;
      }

      const patch: Partial<DocBlock> = { type, html: rest };
      if (type === "todo") patch.checked = false;
      commit(replaceAt(index, patch), {
        id: blocks[index].id,
        offset: plainText(rest).length,
      });
    },
    [blocks, commit, replaceAt],
  );

  const onInput = useCallback(
    (id: string, html: string) => {
      const index = indexOf(id);
      if (index === -1) return;
      const block = blocks[index];
      const text = plainText(html);

      // Markdown shortcuts. Not in a code block — "# " is a comment there,
      // not a heading.
      if (block.type !== "code") {
        const shortcut = MARKDOWN_SHORTCUTS.find((s) => text.startsWith(s.prefix));
        if (shortcut) {
          applyMarkdown(index, shortcut.type, shortcut.prefix, html, text);
          return;
        }
      }

      // The slash menu opens only when "/" is the first thing in the block.
      // Notion allows it mid-line; restricting it means a URL or a fraction
      // typed in prose can never hijack the caret, and the rule is one
      // someone can actually hold in their head.
      const query = slashQuery(text);
      if (query === null) {
        if (slash?.blockId === id) setSlash(null);
      } else {
        const rect = caretRect();
        setSlash({
          blockId: id,
          query,
          anchor: rect
            ? { x: rect.left, y: rect.top, bottom: rect.bottom }
            : slash?.anchor ?? { x: 200, y: 200, bottom: 220 },
          index: 0,
        });
      }

      commit(replaceAt(index, { html }));
    },
    [applyMarkdown, blocks, commit, indexOf, replaceAt, slash],
  );

  const onPasteText = useCallback(
    (id: string, text: string, el: HTMLElement) => {
      const lines = text.split(/\r?\n/);

      if (lines.length === 1) {
        // One line goes in at the caret and rides the normal input event.
        insertPlainText(text);
        return;
      }

      const index = indexOf(id);
      if (index === -1) return;

      const split = splitAtCaret(el) ?? { before: blocks[index].html, after: "" };
      const first = { ...blocks[index], html: split.before + escapeHtml(lines[0]) };
      const middle = lines.slice(1, -1).map((line) => ({
        ...emptyBlock(blocks[index].type === "code" ? "code" : "text"),
        html: escapeHtml(line),
      }));
      const lastLine = lines[lines.length - 1];
      const last: DocBlock = {
        ...emptyBlock(blocks[index].type === "code" ? "code" : "text"),
        html: escapeHtml(lastLine) + split.after,
      };

      commit(
        [...blocks.slice(0, index), first, ...middle, last, ...blocks.slice(index + 1)],
        { id: last.id, offset: lastLine.length },
      );
    },
    [blocks, commit, indexOf],
  );

  /* ---- keyboard ------------------------------------------------------- */

  const chooseType = useCallback(
    (id: string, type: DocBlockType, opts?: { clearText?: boolean }) => {
      const index = indexOf(id);
      if (index === -1) return;

      setSlash(null);
      setMenu(null);

      const html = opts?.clearText ? "" : blocks[index].html;

      if (type === "divider") {
        const divider: DocBlock = { ...blocks[index], type: "divider", html: "" };
        const next = blocks.map((b, i) => (i === index ? divider : b));
        // A divider can't hold a caret, so make sure there's somewhere to
        // carry on typing underneath it.
        const follower = next[index + 1];
        if (follower && follower.type !== "divider") {
          commit(next, { id: follower.id, offset: 0 });
          return;
        }
        const added = emptyBlock();
        commit([...next.slice(0, index + 1), added, ...next.slice(index + 1)], {
          id: added.id,
          offset: 0,
        });
        return;
      }

      const patch: Partial<DocBlock> = { type, html };
      if (type === "todo") patch.checked = blocks[index].checked ?? false;
      commit(replaceAt(index, patch), { id, offset: plainText(html).length });
    },
    [blocks, commit, indexOf, replaceAt],
  );

  const splitBlock = useCallback(
    (id: string, el: HTMLElement) => {
      const index = indexOf(id);
      if (index === -1) return;
      const block = blocks[index];
      const split = splitAtCaret(el) ?? { before: block.html, after: "" };

      // Enter on an empty list item leaves the list rather than making
      // another empty one — the standard way out of a list without a mouse.
      if (CONTINUING.includes(block.type) && plainText(block.html).trim() === "") {
        commit(replaceAt(index, { type: "text", html: "", checked: undefined }), {
          id,
          offset: 0,
        });
        return;
      }

      const continues = CONTINUING.includes(block.type);
      const added: DocBlock = {
        id: newBlockId(),
        type: continues ? block.type : "text",
        html: split.after,
        ...(continues && block.type === "todo" ? { checked: false } : {}),
      };

      commit(
        [
          ...blocks.slice(0, index),
          { ...block, html: split.before },
          added,
          ...blocks.slice(index + 1),
        ],
        { id: added.id, offset: 0 },
      );
    },
    [blocks, commit, indexOf, replaceAt],
  );

  const mergeBackwards = useCallback(
    (index: number) => {
      const block = blocks[index];
      const previous = blocks[index - 1];

      if (previous.type === "divider") {
        commit(blocks.filter((_, i) => i !== index - 1), { id: block.id, offset: 0 });
        return;
      }

      const offset = plainText(previous.html).length;
      const merged = { ...previous, html: previous.html + block.html };
      commit(
        [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)],
        { id: previous.id, offset },
      );
    },
    [blocks, commit],
  );

  const removeBlock = useCallback(
    (id: string) => {
      const index = indexOf(id);
      if (index === -1) return;

      // A document always keeps one block, or there'd be nothing to click on.
      if (blocks.length === 1) {
        const fresh = emptyBlock();
        commit([fresh], { id: fresh.id, offset: 0 });
        return;
      }

      const next = blocks.filter((_, i) => i !== index);
      const neighbour = next[Math.max(0, index - 1)];
      commit(next, { id: neighbour.id, offset: plainText(neighbour.html).length });
    },
    [blocks, commit, indexOf],
  );

  const onKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent<HTMLElement>, el: HTMLElement) => {
      if (!editable) return;

      const index = indexOf(id);
      if (index === -1) return;
      const block = blocks[index];

      // The slash menu is driven from here because the caret has to stay in
      // the block — see `slash-menu.tsx`.
      if (slash && slash.blockId === id) {
        const options = matchBlockTypes(slash.query);
        if (options.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSlash({ ...slash, index: (slash.index + 1) % options.length });
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSlash({
              ...slash,
              index: (slash.index - 1 + options.length) % options.length,
            });
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            chooseType(id, options[slash.index].type, { clearText: true });
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlash(null);
          return;
        }
      }

      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && ["b", "i", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        applyInlineFormat(
          e.key.toLowerCase() === "b"
            ? "bold"
            : e.key.toLowerCase() === "i"
              ? "italic"
              : "underline",
        );
        return;
      }

      if (mod && e.key === "Enter" && block.type === "todo") {
        e.preventDefault();
        commit(replaceAt(index, { checked: !block.checked }));
        return;
      }

      if (e.key === "Escape") {
        closeOverlays();
        return;
      }

      if (block.type === "divider") {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          removeBlock(id);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const added = emptyBlock();
          commit(
            [...blocks.slice(0, index + 1), added, ...blocks.slice(index + 1)],
            { id: added.id, offset: 0 },
          );
        }
        if (e.key === "ArrowUp" && index > 0) {
          e.preventDefault();
          setFocus({
            id: blocks[index - 1].id,
            offset: plainText(blocks[index - 1].html).length,
          });
        }
        if (e.key === "ArrowDown" && index < blocks.length - 1) {
          e.preventDefault();
          setFocus({ id: blocks[index + 1].id, offset: 0 });
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        if (block.type === "code") {
          // A code block keeps Enter for itself; Cmd+Enter leaves it.
          if (!mod) {
            e.preventDefault();
            insertLineBreak();
            return;
          }
          e.preventDefault();
          const added = emptyBlock();
          commit(
            [...blocks.slice(0, index + 1), added, ...blocks.slice(index + 1)],
            { id: added.id, offset: 0 },
          );
          return;
        }
        e.preventDefault();
        splitBlock(id, el);
        return;
      }

      if (e.key === "Backspace" && !hasSelection(el) && caretAtStart(el)) {
        if (block.type !== "text") {
          e.preventDefault();
          commit(replaceAt(index, { type: "text", checked: undefined }), {
            id,
            offset: 0,
          });
          return;
        }
        if (index > 0) {
          e.preventDefault();
          mergeBackwards(index);
          return;
        }
        if (blocks.length > 1 && plainText(block.html).trim() === "") {
          e.preventDefault();
          removeBlock(id);
        }
        return;
      }

      if (
        e.key === "Delete" &&
        !hasSelection(el) &&
        caretAtEnd(el) &&
        index < blocks.length - 1
      ) {
        e.preventDefault();
        const next = blocks[index + 1];
        if (next.type === "divider") {
          commit(blocks.filter((_, i) => i !== index + 1), {
            id,
            offset: plainText(block.html).length,
          });
          return;
        }
        const offset = plainText(block.html).length;
        commit(
          [
            ...blocks.slice(0, index),
            { ...block, html: block.html + next.html },
            ...blocks.slice(index + 2),
          ],
          { id, offset },
        );
        return;
      }

      // Arrow keys only leave the block from its very edge, so multi-line
      // blocks still navigate internally.
      if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && index > 0 && caretAtStart(el)) {
        e.preventDefault();
        const previous = blocks[index - 1];
        setFocus({ id: previous.id, offset: plainText(previous.html).length });
        return;
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowRight") &&
        index < blocks.length - 1 &&
        caretAtEnd(el)
      ) {
        e.preventDefault();
        setFocus({ id: blocks[index + 1].id, offset: 0 });
      }
    },
    [
      blocks,
      chooseType,
      closeOverlays,
      commit,
      editable,
      indexOf,
      mergeBackwards,
      removeBlock,
      replaceAt,
      slash,
      splitBlock,
    ],
  );

  /* ---- pointer -------------------------------------------------------- */

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const from = blocks.findIndex((b) => b.id === active.id);
      const to = blocks.findIndex((b) => b.id === over.id);
      if (from === -1 || to === -1) return;

      commit(arrayMove(blocks, from, to));
    },
    [blocks, commit],
  );

  const insertBelow = useCallback(
    (id: string) => {
      const index = indexOf(id);
      if (index === -1) return;
      const added = emptyBlock();
      commit([...blocks.slice(0, index + 1), added, ...blocks.slice(index + 1)], {
        id: added.id,
        offset: 0,
      });
    },
    [blocks, commit, indexOf],
  );

  /** Clicking the empty space under the document appends a block, like Notion. */
  const onClickTail = useCallback(() => {
    if (!editable) return;
    const last = blocks[blocks.length - 1];
    if (last && last.type === "text" && plainText(last.html).trim() === "") {
      setFocus({ id: last.id, offset: 0 });
      return;
    }
    const added = emptyBlock();
    commit([...blocks, added], { id: added.id, offset: 0 });
  }, [blocks, commit, editable]);

  /* ---- render --------------------------------------------------------- */

  const ordinals = useMemo(() => numbering(blocks), [blocks]);
  const slashOptions = slash ? matchBlockTypes(slash.query) : [];
  const menuBlock = menu ? blocks.find((b) => b.id === menu.blockId) : undefined;

  return (
    <>
      <div className="flex items-center justify-end pb-1">
        <SaveStatus state={saveState} readOnly={!editable} />
      </div>

      <div ref={rootRef}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={closeOverlays}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block, i) => (
              <BlockRow
                key={block.id}
                block={block}
                ordinal={ordinals[i]}
                editable={editable}
                primary={i === 0}
                onInput={(html) => onInput(block.id, html)}
                onKeyDown={(e, el) => onKeyDown(block.id, e, el)}
                onPasteText={(text, el) => onPasteText(block.id, text, el)}
                onToggleTodo={() =>
                  commit(
                    blocks.map((b) =>
                      b.id === block.id ? { ...b, checked: !b.checked } : b,
                    ),
                  )
                }
                onInsertBelow={() => insertBelow(block.id)}
                onOpenMenu={(anchor) => {
                  const rect = anchor.getBoundingClientRect();
                  setSlash(null);
                  setMenu({ blockId: block.id, x: rect.left, y: rect.bottom + 6 });
                }}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/*
          The empty space under the last block is a click target that appends
          one, exactly as it is in Notion. Not a control: a keyboard user
          reaches the same block by pressing Enter at the end of the last one.
        */}
        <div
          role="presentation"
          className="h-40 cursor-text"
          onClick={onClickTail}
        />
      </div>

      {slash && slashOptions.length > 0 ? (
        <SlashMenu
          options={slashOptions}
          activeIndex={slash.index}
          anchor={slash.anchor}
          onChoose={(type) => chooseType(slash.blockId, type, { clearText: true })}
        />
      ) : null}

      {menu && menuBlock ? (
        <BlockMenu
          anchor={{ x: menu.x, y: menu.y }}
          currentType={menuBlock.type}
          onTurnInto={(type) => chooseType(menu.blockId, type)}
          onDuplicate={() => {
            const index = indexOf(menu.blockId);
            if (index === -1) return;
            const copy = { ...blocks[index], id: newBlockId() };
            setMenu(null);
            commit([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)], {
              id: copy.id,
              offset: plainText(copy.html).length,
            });
          }}
          onDelete={() => {
            setMenu(null);
            removeBlock(menu.blockId);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}

/* ---- pure helpers ------------------------------------------------------ */

/**
 * `null` when the block isn't in slash mode. A query stops at the first
 * space so "/ nothing in particular" is prose, not a search.
 */
function slashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  const query = text.slice(1);
  if (query.includes(" ") || query.length > 24) return null;
  return query;
}

/** 1-based position of each block within its own run of numbered blocks. */
function numbering(blocks: DocBlock[]): number[] {
  let run = 0;
  return blocks.map((block) => {
    if (block.type !== "numbered") {
      run = 0;
      return 0;
    }
    run += 1;
    return run;
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
