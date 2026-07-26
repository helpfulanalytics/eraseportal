import {
  ListFilterIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  StarIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Composer } from "@/components/conversation/composer";
import { MessageList } from "@/components/conversation/message-list";
import { DataTable, type Row } from "@/components/kitchen/data-table";
import { FileThumb } from "@/components/kitchen/file-thumb";
import { SubTabs } from "@/components/kitchen/page-title";
import { AvatarStack } from "@/components/kitchen/person-avatar";
import { ShareDialog } from "@/components/kitchen/share-dialog";
import {
  formatBytes,
  formatShortDate,
  getConversation,
  getConversationFiles,
  getMessages,
  getPerson,
} from "@/lib/kitchen-data";

// Next 16: both params and searchParams are Promises.
export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { conversationId } = await params;
  const { tab } = await searchParams;

  const conversation = getConversation(conversationId);
  if (!conversation) notFound();

  const messages = getMessages(conversationId);
  const showFiles = tab === "files";
  const base = `/conversations/${conversationId}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-5 pt-4">
        <div className="flex items-center gap-2">
          <MessageSquareIcon
            className="size-[18px] shrink-0 text-k-black-56"
            strokeWidth={1.6}
          />
          <h1 className="min-w-0 truncate font-medium text-k-black-84 text-section">
            {conversation.name}
          </h1>
          <button
            type="button"
            aria-label="Favourite"
            className="flex size-7 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <StarIcon className="size-4" strokeWidth={1.6} />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Filter"
              className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
            >
              <ListFilterIcon className="size-4" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              aria-label="More"
              className="flex size-7 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
            >
              <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
            </button>
            <AvatarStack personIds={conversation.participantIds} />
            <ShareDialog title={conversation.name} />
          </div>
        </div>

        <SubTabs
          className="mt-3 border-k-black-06 border-b"
          tabs={[
            { label: "Messages", href: base, active: !showFiles },
            { label: "Files", href: `${base}?tab=files`, active: showFiles },
          ]}
        />
      </div>

      {showFiles ? (
        <FilesTab conversationId={conversationId} />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageList messages={messages} />
          </div>
          <Composer />
        </>
      )}
    </div>
  );
}

function FilesTab({ conversationId }: { conversationId: string }) {
  const files = getConversationFiles(conversationId);

  const rows: Row[] = files.map((file) => ({
    id: file.id,
    cells: {
      name: (
        <div className="flex min-w-0 items-center gap-3">
          <FileThumb />
          <div className="min-w-0">
            <div className="truncate text-k-black-84 text-md">{file.name}</div>
            <div className="text-k-black-40 text-md">
              {file.label} • {formatBytes(file.bytes)}
            </div>
          </div>
        </div>
      ),
      author: getPerson(file.authorId)?.name ?? "—",
      created: formatShortDate(file.createdAt),
    },
  }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "author", label: "Author", width: "160px" },
          { key: "created", label: "Created", width: "120px" },
        ]}
        rows={rows}
        empty="No files shared yet."
      />
    </div>
  );
}
