"use client";

/**
 * One row of the block editor: the hover controls, the list marker, and the
 * `contenteditable` itself.
 *
 * The editable element is **uncontrolled**. React writes its `innerHTML` only
 * when what's in state differs from what's already in the DOM — which, while
 * someone is typing, it never does, because `onInput` reports the DOM's own
 * HTML back up. Any other arrangement rebuilds the text nodes on every
 * keystroke and throws the caret to the start of the block. Everything else
 * about this file follows from that one constraint.
 */
import { useLayoutEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckIcon, GripVerticalIcon, PlusIcon } from "lucide-react";
import { blockPlaceholder } from "@/components/document/block-types";
import { plainText } from "@/lib/doc-blocks";
import type { DocBlock } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/** Type-specific typography for the editable surface. */
const BLOCK_CLASS: Record<DocBlock["type"], string> = {
  text: "text-k-black-84 text-md",
  h1: "font-semibold text-h1 text-k-black-84",
  h2: "font-semibold text-h2 text-k-black-84",
  h3: "font-semibold text-h3 text-k-black-84",
  bullet: "text-k-black-84 text-md",
  numbered: "text-k-black-84 text-md",
  todo: "text-k-black-84 text-md",
  quote: "text-k-black-72 text-md italic",
  code: "whitespace-pre-wrap rounded-lg bg-k-black-03 p-3 font-mono text-k-black-84 text-sm",
  divider: "",
};

/** Vertical rhythm — headings need air above them, list items don't. */
const BLOCK_SPACING: Record<DocBlock["type"], string> = {
  text: "py-[3px]",
  h1: "pt-6 pb-1",
  h2: "pt-5 pb-1",
  h3: "pt-4 pb-0.5",
  bullet: "py-[3px]",
  numbered: "py-[3px]",
  todo: "py-[3px]",
  quote: "py-1",
  code: "py-1.5",
  divider: "py-3",
};

export function BlockRow({
  block,
  ordinal,
  editable,
  primary,
  onInput,
  onKeyDown,
  onPasteText,
  onToggleTodo,
  onInsertBelow,
  onOpenMenu,
}: {
  block: DocBlock;
  /** 1-based position within its run of numbered blocks. */
  ordinal: number;
  editable: boolean;
  /**
   * The document's first block, which keeps its placeholder even unfocused —
   * an empty document with no prompt in it reads as broken.
   */
  primary: boolean;
  onInput: (html: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, el: HTMLElement) => void;
  onPasteText: (text: string, el: HTMLElement) => void;
  onToggleTodo: () => void;
  onInsertBelow: () => void;
  /** Opens the block menu at the handle; also the drag handle's own button. */
  onOpenMenu: (anchor: HTMLElement) => void;
}) {
  const editableRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: !editable });

  // No dependency array: the comparison against the live DOM *is* the
  // dependency. See the note at the top of the file.
  useLayoutEffect(() => {
    const el = editableRef.current;
    if (el && el.innerHTML !== block.html) el.innerHTML = block.html;
  });

  const empty = plainText(block.html).trim().length === 0;

  const row = (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative flex items-start gap-1.5",
        BLOCK_SPACING[block.type],
        isDragging && "z-10 opacity-40",
      )}
    >
      {editable ? (
        <div
          contentEditable={false}
          className="-left-[52px] absolute flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
          style={{ top: blockControlsTop(block.type) }}
        >
          <button
            type="button"
            aria-label="Add block below"
            onClick={onInsertBelow}
            className="flex size-5 items-center justify-center rounded text-k-black-24 transition-colors hover:bg-k-black-04 hover:text-k-black-72"
          >
            <PlusIcon className="size-4" strokeWidth={1.7} />
          </button>
          <button
            {...attributes}
            {...listeners}
            ref={(node) => {
              setActivatorNodeRef(node);
              handleRef.current = node;
            }}
            type="button"
            aria-label="Block options"
            onClick={() => {
              if (handleRef.current) onOpenMenu(handleRef.current);
            }}
            className="flex size-5 cursor-grab items-center justify-center rounded text-k-black-24 transition-colors hover:bg-k-black-04 hover:text-k-black-72 active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" strokeWidth={1.7} />
          </button>
        </div>
      ) : null}

      <Marker
        block={block}
        ordinal={ordinal}
        editable={editable}
        onToggleTodo={onToggleTodo}
      />

      {block.type === "divider" ? (
        // A divider has no text, but it still has to be reachable: focusable
        // so Backspace can remove it and so the caret can pass through it
        // with the arrow keys.
        <div
          tabIndex={0}
          role="separator"
          aria-label="Divider"
          data-editable="true"
          onKeyDown={(e) => onKeyDown(e, e.currentTarget)}
          className="min-w-0 flex-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-k-blue-32"
        >
          <hr className="border-k-black-08 border-t" />
        </div>
      ) : (
        <div
          ref={editableRef}
          data-editable="true"
          data-empty={empty ? "true" : "false"}
          data-primary={primary ? "true" : "false"}
          data-placeholder={blockPlaceholder(block.type)}
          contentEditable={editable}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={blockPlaceholder(block.type)}
          spellCheck
          onInput={(e) => onInput(e.currentTarget.innerHTML)}
          onKeyDown={(e) => onKeyDown(e, e.currentTarget)}
          onPaste={(e) => {
            // Always paste as plain text. Anything else drops a foreign
            // stylesheet's worth of markup into the document, and the
            // sanitiser would strip most of it on save anyway — better to
            // never show it than to show it and take it away.
            e.preventDefault();
            onPasteText(e.clipboardData.getData("text/plain"), e.currentTarget);
          }}
          className={cn(
            // `relative` anchors the placeholder pseudo-element — see the
            // `[data-editable]` rules in globals.css.
            "relative min-w-0 flex-1 outline-none",
            BLOCK_CLASS[block.type],
            block.type === "quote" && "border-k-black-16 border-l-2 pl-3",
            block.type === "todo" && block.checked && "text-k-black-36 line-through",
            !editable && "cursor-default",
          )}
        />
      )}
    </div>
  );

  return row;
}

/** The controls sit level with the first line of text, whatever its size. */
function blockControlsTop(type: DocBlock["type"]): number {
  switch (type) {
    case "h1":
      return 26;
    case "h2":
      return 21;
    case "h3":
      return 17;
    case "code":
      return 12;
    case "divider":
      return 8;
    default:
      return 2;
  }
}

function Marker({
  block,
  ordinal,
  editable,
  onToggleTodo,
}: {
  block: DocBlock;
  ordinal: number;
  editable: boolean;
  onToggleTodo: () => void;
}) {
  if (block.type === "bullet") {
    return (
      <span
        aria-hidden="true"
        contentEditable={false}
        className="w-4 shrink-0 select-none pt-px text-center text-k-black-40 text-md"
      >
        •
      </span>
    );
  }

  if (block.type === "numbered") {
    return (
      <span
        aria-hidden="true"
        contentEditable={false}
        className="w-4 shrink-0 select-none text-right text-k-black-40 text-md tabular-nums"
      >
        {ordinal}.
      </span>
    );
  }

  if (block.type === "todo") {
    return (
      <button
        type="button"
        contentEditable={false}
        disabled={!editable}
        role="checkbox"
        aria-checked={block.checked === true}
        aria-label="Toggle to-do"
        onClick={onToggleTodo}
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          block.checked
            ? "border-k-blue bg-k-blue text-k-white"
            : "border-k-black-24 hover:border-k-black-40",
        )}
      >
        {block.checked ? <CheckIcon className="size-3" strokeWidth={2.5} /> : null}
      </button>
    );
  }

  return null;
}
