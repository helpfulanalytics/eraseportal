import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The recurring page header: two or more titles sitting side by side at title
 * size, with the inactive ones greyed back. Used by Clients/Companies and
 * All Tasks/Completed.
 */
export function PageTitleTabs({
  tabs,
  className,
}: {
  tabs: Array<{ label: string; href: string; active: boolean; icon?: React.ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-1", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            // Titles wrap as whole words between tabs, never mid-phrase.
            "flex items-center gap-2.5 whitespace-nowrap font-semibold text-title transition-colors",
            tab.active
              ? "text-k-black-84"
              : "text-k-black-24 hover:text-k-black-40",
          )}
        >
          {tab.icon}
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** Underlined sub-tab row (Table/Calendar, Messages/Files). */
export function SubTabs({
  tabs,
  className,
}: {
  tabs: Array<{ label: string; href: string; active: boolean }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-5", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 pb-2 text-md transition-colors",
            tab.active
              ? "border-k-black-84 text-k-black-84"
              : "border-transparent text-k-black-40 hover:text-k-black-72",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
