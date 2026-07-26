import Link from "next/link";
import { MoreHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column {
  key: string;
  label: string;
  /** Fixed width; the first column is left to fill the remaining space. */
  width?: string;
  align?: "left" | "right";
  /** Renders a sort caret next to the label. */
  sorted?: "asc" | "desc";
}

export interface Row {
  id: string;
  href?: string;
  cells: Record<string, React.ReactNode>;
}

/**
 * The one table pattern used across folder items, clients and tasks: a hairline
 * header, generously padded rows, and a trailing `⋯` that appears on hover.
 */
export function DataTable({
  columns,
  rows,
  empty = "No results found.",
  headerAction,
  className,
}: {
  columns: Column[];
  rows: Row[];
  empty?: string;
  /** Slot at the far right of the header — column picker, layout toggle, etc. */
  headerAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-4 border-k-black-06 border-b px-3 pb-2">
        {columns.map((col, i) => (
          <div
            key={col.key}
            className={cn(
              "flex items-center gap-1 text-k-black-40 text-md",
              i === 0 ? "min-w-0 flex-1" : "shrink-0",
              col.align === "right" && "justify-end",
            )}
            style={col.width ? { width: col.width } : undefined}
          >
            {col.label}
            {col.sorted ? (
              <span aria-hidden="true" className="text-2xs">
                {col.sorted === "asc" ? "↑" : "↓"}
              </span>
            ) : null}
          </div>
        ))}
        <div className="flex w-8 shrink-0 justify-end">{headerAction}</div>
      </div>

      {rows.length === 0 ? (
        <div className="border-k-black-06 border-b py-8 text-center text-k-black-40 text-md">
          {empty}
        </div>
      ) : (
        <ul>
          {rows.map((row) => {
            const content = (
              <div className="flex items-center gap-4 px-3 py-2.5">
                {columns.map((col, i) => (
                  <div
                    key={col.key}
                    className={cn(
                      i === 0 ? "min-w-0 flex-1" : "shrink-0",
                      col.align === "right" && "text-right",
                      i > 0 && "text-k-black-56 text-md",
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {row.cells[col.key]}
                  </div>
                ))}
                <div className="flex w-8 shrink-0 justify-end">
                  <span className="flex size-6 items-center justify-center rounded-md text-k-black-24 opacity-0 transition-opacity group-hover/row:opacity-100">
                    <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
                  </span>
                </div>
              </div>
            );

            return (
              <li
                key={row.id}
                className="group/row border-k-black-06 border-b transition-colors hover:bg-k-black-02"
              >
                {row.href ? (
                  <Link href={row.href} className="block">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
