import type { Metadata } from "next";
import { MessageSquareIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { ConversationView } from "@/components/conversation/conversation-view";
import { ConversationHeaderControls } from "@/components/kitchen/conversation-header-controls";
import { DataTable, type Row } from "@/components/kitchen/data-table";
import { ItemThumb } from "@/components/kitchen/item-thumb";
import { SubTabs } from "@/components/kitchen/page-title";
import { AvatarStack } from "@/components/kitchen/person-avatar";
import { StarButton } from "@/components/kitchen/star-button";
import { requireFolderAccess } from "@/lib/access-guard";
import {
  getConversation,
  getConversationFiles,
  getFolder,
  getMessages,
  getPeople,
} from "@/lib/kitchen-data";
import { formatBytes, formatShortDate } from "@/lib/kitchen-format";

// Next 16: both params and searchParams are Promises.
type PageProps = {
  params: Promise<{ orgSlug: string; conversationId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { conversationId } = await params;
  const conversation = await getConversation(conversationId);
  if (!conversation) return {};

  const title = conversation.name;
  return {
    title,
    openGraph: {
      images: [`/api/og?title=${encodeURIComponent(title)}&type=Conversation`],
    },
    twitter: {
      images: [`/api/og?title=${encodeURIComponent(title)}&type=Conversation`],
    },
  };
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; conversationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgSlug, conversationId } = await params;
  const { tab } = await searchParams;

  const conversation = await getConversation(conversationId);
  if (!conversation) notFound();

  const folder = await getFolder(conversation.folderId);
  await requireFolderAccess(folder);

  const messages = await getMessages(conversationId);
  const showFiles = tab === "files";
  const base = `/w/${orgSlug}/conversations/${conversationId}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-5 pt-4">
        <div className="flex items-center gap-2">
          <MessageSquareIcon
            className="size-[18px] shrink-0 text-k-black-56"
            strokeWidth={1.6}
          />
          <ConversationHeaderControls
            conversationId={conversationId}
            folderId={conversation.folderId}
            name={conversation.name}
          />
          <StarButton
            kind="conversation"
            id={conversationId}
            starred={conversation.starred}
          />

          {/*
            The Filter control that used to sit here had nothing to filter —
            a message list has no facets in this model. Dropped rather than
            left as a button that does nothing.
          */}
          <div className="ml-auto flex items-center gap-2">
            <AvatarStack personIds={conversation.participantIds} />
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
        <ConversationView
          conversationId={conversationId}
          participantIds={conversation.participantIds}
          messages={messages}
        />
      )}
    </div>
  );
}

async function FilesTab({ conversationId }: { conversationId: string }) {
  const [files, people] = await Promise.all([
    getConversationFiles(conversationId),
    getPeople(),
  ]);

  const rows: Row[] = files.map((file) => ({
    id: file.id,
    cells: {
      name: (
        <div className="flex min-w-0 items-center gap-3">
          <ItemThumb
            subject={{
              kind: "file",
              file: { label: file.label, mime: file.mime, url: file.url },
            }}
            name={file.name}
          />
          <div className="min-w-0">
            <div className="truncate text-k-black-84 text-md">{file.name}</div>
            <div className="text-k-black-40 text-md">
              {file.label} • {formatBytes(file.bytes)}
            </div>
          </div>
        </div>
      ),
      author: people[file.authorId]?.name ?? "—",
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
