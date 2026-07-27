"use client";

/**
 * Create dialog for everything except Folder — board, conversation, embed,
 * link, document, proposal and client.
 *
 * One component rather than seven, because the differences between them are
 * three booleans: does it live in a folder, does it need a URL, is it a
 * person. Seven near-identical files would be seven places to fix the next
 * spacing change.
 *
 * Folder keeps its own dialog: it's the only one with a description and an
 * access group, and forcing those into this shape would make both worse.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBoardAction,
  createClientAction,
  createConversationAction,
  createDocumentAction,
  createEmbedAction,
} from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";

/** Everything this dialog can make. Folder is handled elsewhere. */
export type ItemType =
  | "board"
  | "conversation"
  | "embed"
  | "link"
  | "document"
  | "proposal"
  | "client";

const NEEDS_FOLDER: Record<ItemType, boolean> = {
  board: true,
  conversation: true,
  embed: true,
  link: true,
  document: true,
  proposal: true,
  client: false,
};

const NEEDS_URL: Record<ItemType, boolean> = {
  board: false,
  conversation: false,
  embed: true,
  link: true,
  document: false,
  proposal: false,
  client: false,
};

export function CreateItemDialog({
  type,
  title,
  folderId,
  folders = [],
  onClose,
}: {
  type: ItemType;
  /** e.g. "Board" — the dialog titles itself "Create Board". */
  title: string;
  /** Set when opened from inside a folder; hides the picker. */
  folderId?: string;
  folders?: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState(folderId ?? folders[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const needsFolder = NEEDS_FOLDER[type] && !folderId;
  const needsUrl = NEEDS_URL[type];
  const isClient = type === "client";

  const canSubmit =
    Boolean(name.trim()) &&
    (!needsUrl || Boolean(url.trim())) &&
    (!isClient || Boolean(email.trim())) &&
    (!NEEDS_FOLDER[type] || Boolean(folderId ?? target));

  const save = () => {
    if (!canSubmit || pending) return;
    const trimmed = name.trim();
    const dest = folderId ?? target;
    setError(null);

    startTransition(async () => {
      try {
        switch (type) {
          case "board":
            onClose();
            router.push(`/boards/${await createBoardAction(dest, trimmed)}`);
            break;
          case "conversation":
            onClose();
            router.push(
              `/conversations/${await createConversationAction(dest, trimmed)}`,
            );
            break;
          // A proposal is stored as a document; the model has no separate type.
          case "document":
          case "proposal":
            onClose();
            router.push(
              `/documents/${await createDocumentAction(dest, trimmed)}`,
            );
            break;
          case "embed":
          case "link": {
            const id = await createEmbedAction(
              dest,
              trimmed,
              url,
              type === "link" ? "Link" : "Embed",
            );
            onClose();
            router.push(`/embeds/${id}`);
            break;
          }
          case "client":
            await createClientAction(trimmed, email);
            onClose();
            router.push("/clients");
            break;
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't create that.",
        );
      }
    });
  };

  // Enter submits from any field, matching the folder dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };

  return (
    <DialogShell
      title={`Create ${title}`}
      onClose={onClose}
      onSubmit={save}
      canSubmit={canSubmit}
      pending={pending}
      error={error}
    >
      <div className="flex flex-col gap-4 px-6">
        {needsFolder ? (
          <div>
            <FieldLabel>Folder</FieldLabel>
            <select
              value={target}
              aria-label="Folder"
              disabled={pending}
              onChange={(e) => setTarget(e.target.value)}
              className={`${dialogFieldClass} bg-background`}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <FieldLabel>{isClient ? "Client name" : `${title} name`}</FieldLabel>
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label={isClient ? "Client name" : `${title} name`}
            placeholder={isClient ? "Jane Doe" : `Enter a name...`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            className={dialogFieldClass}
          />
        </div>

        {needsUrl ? (
          <div>
            <FieldLabel>URL</FieldLabel>
            <input
              value={url}
              disabled={pending}
              aria-label="URL"
              placeholder="https://example.com"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={onKeyDown}
              className={dialogFieldClass}
            />
          </div>
        ) : null}

        {isClient ? (
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              value={email}
              type="email"
              disabled={pending}
              aria-label="Client email"
              placeholder="client@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              className={dialogFieldClass}
            />
          </div>
        ) : null}
      </div>
    </DialogShell>
  );
}
