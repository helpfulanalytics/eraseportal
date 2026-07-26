import {
  ArchiveIcon,
  ListFilterIcon,
  MailOpenIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import Link from "next/link";
import { SubTabs } from "@/components/kitchen/page-title";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { formatShortDate, getPerson, INBOX } from "@/lib/kitchen-data";
import { cn } from "@/lib/utils";

const TABS = ["chats", "tasks", "files", "updates"] as const;
type Tab = (typeof TABS)[number];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "chats";
  const entries = INBOX.filter((e) =>
    active === "chats" ? e.kind === "chat" : e.kind === active.slice(0, -1),
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[420px] shrink-0 flex-col border-k-black-06 border-r">
        <div className="shrink-0 px-5 pt-4">
          <div className="flex items-center gap-1">
            <h1 className="flex-1 font-medium text-k-black-84 text-section">
              Inbox
            </h1>
            <HeaderAction label="Archive">
              <ArchiveIcon className="size-4" strokeWidth={1.6} />
            </HeaderAction>
            <HeaderAction label="Mark all read">
              <MailOpenIcon className="size-4" strokeWidth={1.6} />
            </HeaderAction>
            <HeaderAction label="Filter">
              <ListFilterIcon className="size-4" strokeWidth={1.6} />
            </HeaderAction>
            <HeaderAction label="More">
              <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
            </HeaderAction>
          </div>

          <SubTabs
            className="mt-3 border-k-black-06 border-b"
            tabs={TABS.map((t) => ({
              label: t[0].toUpperCase() + t.slice(1),
              href: t === "chats" ? "/inbox" : `/inbox?tab=${t}`,
              active: t === active,
            }))}
          />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <li className="px-5 py-10 text-center text-k-black-40 text-md">
              Nothing here yet.
            </li>
          ) : (
            entries.map((entry) => {
              const author = getPerson(entry.authorId);
              return (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    className="block px-5 py-3.5 transition-colors hover:bg-k-black-02"
                  >
                    <div className="flex items-center gap-2">
                      <PersonAvatar
                        personId={entry.authorId}
                        className="size-4"
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold text-k-black-84 text-md">
                        {author?.name}
                      </span>
                      <span className="shrink-0 text-k-black-40 text-md">
                        {formatShortDate(entry.createdAt)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 line-clamp-2 text-k-black-84 text-md",
                        entry.system && "italic",
                      )}
                    >
                      {entry.preview}
                    </p>
                    <p className="mt-1 truncate text-k-black-36 text-md">
                      {entry.breadcrumb.join(" / ")}
                    </p>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-8">
        <p className="text-center text-k-black-36 text-md">
          Select a conversation to read it here.
        </p>
      </div>
    </div>
  );
}

function HeaderAction({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
    >
      {children}
    </button>
  );
}
