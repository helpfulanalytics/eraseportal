"use client";

/**
 * `MessageList` and `Composer` are siblings under a server-rendered page, but
 * Reply needs state shared between them (the row that was clicked has to
 * seed the composer's bar). This is the thin client boundary that holds it —
 * everything else about either component stays exactly as it was.
 */
import { useState } from "react";
import { Composer } from "@/components/conversation/composer";
import { MessageList } from "@/components/conversation/message-list";
import type { Message } from "@/lib/kitchen-types";

export function ConversationView({
  conversationId,
  participantIds,
  messages,
}: {
  conversationId: string;
  participantIds: string[];
  messages: Message[];
}) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList messages={messages} onReply={setReplyTo} />
      </div>
      <Composer
        conversationId={conversationId}
        participantIds={participantIds}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </>
  );
}
