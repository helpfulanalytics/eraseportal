import { ExternalLinkIcon, LinkIcon, RefreshCwIcon, StarIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { getEmbed, getFolder } from "@/lib/kitchen-data";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ embedId: string }>;
}) {
  const { embedId } = await params;
  const embed = await getEmbed(embedId);
  if (!embed) notFound();

  const folder = await getFolder(embed.folderId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemTopBar
        breadcrumb={folder?.name ?? ""}
        participants={[]}
        shareTitle={embed.name}
      />

      <div className="shrink-0 px-5 pb-3">
        <div className="flex items-center gap-2">
          <LinkIcon
            className="size-[18px] shrink-0 text-k-black-56"
            strokeWidth={1.6}
          />
          <h1 className="min-w-0 truncate font-medium text-k-black-84 text-section">
            {embed.name}
          </h1>
          <span className="shrink-0 rounded bg-k-black-06 px-1.5 py-px text-2xs text-k-black-64">
            {embed.provider}
          </span>
          <button
            type="button"
            aria-label="Favourite"
            className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <StarIcon className="size-4" strokeWidth={1.6} />
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Reload"
              className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
            >
              <RefreshCwIcon className="size-4" strokeWidth={1.6} />
            </button>
            <a
              href={embed.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
            >
              Open
              <ExternalLinkIcon className="size-3.5" strokeWidth={1.8} />
            </a>
          </div>
        </div>
      </div>

      {/*
        The embedded app is rendered in an iframe with a sandbox attribute.
        Third-party sites commonly set X-Frame-Options / frame-ancestors, in
        which case the frame stays blank — the Open button is the escape hatch.
      */}
      <div className="min-h-0 flex-1 px-5 pb-5">
        <div className="h-full overflow-hidden rounded-xl bg-k-black-03-solid shadow-[0_0_0_0.5px_var(--k-black-08)]">
          <iframe
            src={embed.url}
            title={embed.name}
            className="size-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
}
