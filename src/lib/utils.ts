import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The design system renames Tailwind's font-size scale (see globals.css) and
 * adds a `k-` colour palette. Stock tailwind-merge doesn't know either, so it
 * classifies `text-title` / `text-md` / `text-section` as *colours* and drops
 * them whenever a `text-k-*` colour appears in the same `cn()` call — silently
 * collapsing a 32px page title to inherited body size.
 *
 * Declaring both groups here keeps size and colour in separate conflict
 * buckets, so `cn("text-title", "text-k-black-84")` keeps both.
 */
const FONT_SIZES = [
  "2xs",
  "xs",
  "sm",
  "base",
  "md",
  "lg",
  "xl",
  "title",
  "section",
  // Document-body headings — see the note beside them in globals.css.
  "h1",
  "h2",
  "h3",
] as const;

const twMerge = extendTailwindMerge({
  override: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
