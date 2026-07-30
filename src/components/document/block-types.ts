/**
 * The catalogue of block types, in the order they're offered.
 *
 * One list feeds three surfaces — the slash menu, the "Turn into" submenu on
 * the block handle, and the markdown shortcuts — so a new block type is added
 * here and appears in all three.
 */
import {
  CheckSquareIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  TypeIcon,
} from "lucide-react";
import type { DocBlockType } from "@/lib/kitchen-types";

export interface BlockTypeSpec {
  type: DocBlockType;
  label: string;
  hint: string;
  icon: React.ElementType;
  /** Extra words the slash menu matches on. */
  keywords: string[];
  /** Shown greyed on the right of the slash-menu row. */
  markdown?: string;
}

export const BLOCK_TYPES: BlockTypeSpec[] = [
  {
    type: "text",
    label: "Text",
    hint: "Plain paragraph",
    icon: TypeIcon,
    keywords: ["paragraph", "body", "plain"],
  },
  {
    type: "h1",
    label: "Heading 1",
    hint: "Big section heading",
    icon: Heading1Icon,
    keywords: ["title", "h1"],
    markdown: "#",
  },
  {
    type: "h2",
    label: "Heading 2",
    hint: "Medium section heading",
    icon: Heading2Icon,
    keywords: ["subtitle", "h2"],
    markdown: "##",
  },
  {
    type: "h3",
    label: "Heading 3",
    hint: "Small section heading",
    icon: Heading3Icon,
    keywords: ["h3"],
    markdown: "###",
  },
  {
    type: "bullet",
    label: "Bulleted list",
    hint: "A simple list",
    icon: ListIcon,
    keywords: ["ul", "unordered", "point"],
    markdown: "-",
  },
  {
    type: "numbered",
    label: "Numbered list",
    hint: "A list with order",
    icon: ListOrderedIcon,
    keywords: ["ol", "ordered", "steps"],
    markdown: "1.",
  },
  {
    type: "todo",
    label: "To-do",
    hint: "Track tasks with a checkbox",
    icon: CheckSquareIcon,
    keywords: ["task", "checkbox", "check"],
    markdown: "[]",
  },
  {
    type: "quote",
    label: "Quote",
    hint: "Set text apart",
    icon: QuoteIcon,
    keywords: ["blockquote", "cite"],
    markdown: ">",
  },
  {
    type: "code",
    label: "Code",
    hint: "Monospaced, kept literal",
    icon: CodeIcon,
    keywords: ["snippet", "pre", "monospace"],
    markdown: "```",
  },
  {
    type: "divider",
    label: "Divider",
    hint: "A horizontal rule",
    icon: MinusIcon,
    keywords: ["hr", "line", "separator", "rule"],
    markdown: "---",
  },
];

export function blockSpec(type: DocBlockType): BlockTypeSpec {
  return BLOCK_TYPES.find((spec) => spec.type === type) ?? BLOCK_TYPES[0];
}

/** Slash-menu filtering: label first, then keywords, both prefix-insensitive. */
export function matchBlockTypes(query: string): BlockTypeSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCK_TYPES;

  return BLOCK_TYPES.filter(
    (spec) =>
      spec.label.toLowerCase().includes(q) ||
      spec.keywords.some((word) => word.includes(q)),
  );
}

/**
 * Markdown shortcuts, tried in order against the start of a block's plain
 * text. Longest prefixes come first so `###` isn't swallowed by `#`.
 *
 * The trailing space is part of the trigger for every prefix that is also
 * legal prose ("- " starts a list, "-" is a hyphen). `\`\`\`` and `---` fire
 * without one because neither is something you type mid-sentence at position
 * zero.
 */
export const MARKDOWN_SHORTCUTS: Array<{ prefix: string; type: DocBlockType }> = [
  { prefix: "### ", type: "h3" },
  { prefix: "## ", type: "h2" },
  { prefix: "# ", type: "h1" },
  { prefix: "- ", type: "bullet" },
  { prefix: "* ", type: "bullet" },
  { prefix: "1. ", type: "numbered" },
  { prefix: "[] ", type: "todo" },
  { prefix: "[ ] ", type: "todo" },
  { prefix: "> ", type: "quote" },
  { prefix: "```", type: "code" },
  { prefix: "---", type: "divider" },
];

/** Placeholder shown in an empty, focused block. */
export function blockPlaceholder(type: DocBlockType): string {
  switch (type) {
    case "h1":
      return "Heading 1";
    case "h2":
      return "Heading 2";
    case "h3":
      return "Heading 3";
    case "bullet":
    case "numbered":
      return "List";
    case "todo":
      return "To-do";
    case "quote":
      return "Quote";
    case "code":
      return "Code";
    default:
      return "Write something, or press '/' for blocks";
  }
}
