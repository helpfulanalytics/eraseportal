import { Metadata } from "next";
import { getFolder, getEmbed, getDocument, getConversation, getBoard } from "@/lib/kitchen-data";

type Props = {
  params: Promise<{ type: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;
  
  let title = "Client Workspace";
  let ogType = "Portal";
  
  try {
    switch (type) {
      case "folders": {
        const folder = await getFolder(id);
        if (folder) {
          title = folder.name;
          ogType = "Folder";
        }
        break;
      }
      case "embeds": {
        const embed = await getEmbed(id);
        if (embed) {
          title = embed.name;
          ogType = "Link";
        }
        break;
      }
      case "documents": {
        const doc = await getDocument(id);
        if (doc) {
          title = doc.name;
          ogType = "Document";
        }
        break;
      }
      case "conversations": {
        const conv = await getConversation(id);
        if (conv) {
          title = conv.name;
          ogType = "Conversation";
        }
        break;
      }
      case "boards": {
        const board = await getBoard(id);
        if (board) {
          title = board.name;
          ogType = "Board";
        }
        break;
      }
    }
  } catch (e) {
    console.error("Bot metadata fetch error", e);
  }

  return {
    title,
    openGraph: {
      images: [`/api/og?title=${encodeURIComponent(title)}&type=${encodeURIComponent(ogType)}`],
    },
    twitter: {
      images: [`/api/og?title=${encodeURIComponent(title)}&type=${encodeURIComponent(ogType)}`],
    },
  };
}

export default function BotMetadataPage() {
  // Return empty content, bots only need the <head>
  return null;
}
