"use client";

/**
 * Create dialog for everything except Folder — board, conversation, embed,
 * link, document and proposal. Client creation lives in the admin section
 * instead, where an organization is already in context.
 *
 * One component rather than six, because the differences between them are
 * three small things: does it live in a folder, does it need a URL, and —
 * for Document only — is it a written page or a canvas board. Six
 * near-identical files would be six places to fix the next spacing change.
 *
 * Folder keeps its own dialog: it's the only one with a description and an
 * access group, and forcing those into this shape would make both worse.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, ShapesIcon } from "lucide-react";
import {
  createBoardAction,
  createConversationAction,
  createDocumentAction,
  createEmbedAction,
} from "@/app/(workspace)/actions";
import {
  DialogShell,
  FieldLabel,
  dialogFieldClass,
} from "@/components/kitchen/dialog-shell";
import { useOrgSlug } from "@/components/workspace-provider";
import type { DocumentKind } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/** Everything this dialog can make. Folder and Client are handled elsewhere. */
export type ItemType =
  | "board"
  | "conversation"
  | "embed"
  | "link"
  | "document"
  | "proposal";

const NEEDS_FOLDER: Record<ItemType, boolean> = {
  board: true,
  conversation: true,
  embed: true,
  link: true,
  document: true,
  proposal: true,
};

const NEEDS_URL: Record<ItemType, boolean> = {
  board: false,
  conversation: false,
  embed: true,
  link: true,
  document: false,
  proposal: false,
};

/**
 * The two things "Document" can mean. Asked up front rather than offered as
 * a mode switch inside the editor, because the two are stored differently
 * (`content` vs `nodes`) and nothing converts one into the other — making it
 * a decision after the fact would be a promise the model can't keep.
 *
 * A proposal skips this: it's a written document by definition, so asking
 * would be a question with one real answer.
 */
const DOC_KINDS: Array<{
  key: DocumentKind;
  icon: React.ElementType;
  label: string;
  hint: string;
}> = [
  {
    key: "page",
    icon: FileTextIcon,
    label: "Document",
    hint: "Write, structure and format — headings, lists, checkboxes.",
  },
  {
    key: "canvas",
    icon: ShapesIcon,
    label: "Board",
    hint: "An infinite canvas of sticky notes, shapes and arrows.",
  },
];

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
  /**
   * `organizationSlug` is only meaningful when this dialog opens without a
   * `folderId` (the cross-org home-page picker) — the selected folder can
   * belong to any org, so the redirect after creating needs to look up that
   * folder's own org slug rather than trust the ambient one.
   */
  folders?: Array<{ id: string; name: string; organizationSlug?: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [docKind, setDocKind] = useState<DocumentKind>("page");
  const [target, setTarget] = useState(folderId ?? folders[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const contextOrgSlug = useOrgSlug();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const needsFolder = NEEDS_FOLDER[type] && !folderId;
  const needsUrl = NEEDS_URL[type];
  const needsDocKind = type === "document";

  const canSubmit =
    Boolean(name.trim()) &&
    (!needsUrl || Boolean(url.trim())) &&
    (!NEEDS_FOLDER[type] || Boolean(folderId ?? target));

  const save = () => {
    if (!canSubmit || pending) return;
    const trimmed = name.trim();
    const dest = folderId ?? target;
    const orgSlug =
      folders.find((f) => f.id === dest)?.organizationSlug ?? contextOrgSlug;
    setError(null);

    startTransition(async () => {
      try {
        switch (type) {
          case "board":
            onClose();
            router.push(`/w/${orgSlug}/boards/${await createBoardAction(dest, trimmed)}`);
            break;
          case "conversation":
            onClose();
            router.push(
              `/w/${orgSlug}/conversations/${await createConversationAction(dest, trimmed)}`,
            );
            break;
          // A proposal is stored as a document; the model has no separate type.
          // It's always a written page — only the Document row offers a canvas.
          case "document":
          case "proposal": {
            const kind = type === "document" ? docKind : "page";
            onClose();
            router.push(
              `/w/${orgSlug}/documents/${await createDocumentAction(dest, trimmed, kind)}`,
            );
            break;
          }
          case "embed":
          case "link": {
            const id = await createEmbedAction(
              dest,
              trimmed,
              url,
              type === "link" ? "Link" : "Embed",
            );
            onClose();
            router.push(`/w/${orgSlug}/embeds/${id}`);
            break;
          }
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

  // With a kind chosen, the dialog stops calling it a "Document" — the words
  // on the button and the field should match the thing being made.
  const noun = needsDocKind && docKind === "canvas" ? "Board" : title;

  return (
    <DialogShell
      title={`Create ${noun}`}
      onClose={onClose}
      onSubmit={save}
      canSubmit={canSubmit}
      pending={pending}
      error={error}
    >
      <div className="flex flex-col gap-4 px-6">
        {needsDocKind ? (
          <div>
            <FieldLabel>Type</FieldLabel>
            <div role="radiogroup" aria-label="Document type" className="flex gap-2">
              {DOC_KINDS.map((option) => {
                const selected = docKind === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={pending}
                    onClick={() => setDocKind(option.key)}
                    className={cn(
                      "flex flex-1 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                      selected
                        ? "border-k-blue bg-k-blue-06"
                        : "border-k-black-12 hover:bg-k-black-03",
                    )}
                  >
                    <option.icon
                      className={cn(
                        "size-[18px]",
                        selected ? "text-k-blue" : "text-k-black-56",
                      )}
                      strokeWidth={1.6}
                    />
                    <span className="font-medium text-k-black-84 text-md">
                      {option.label}
                    </span>
                    <span className="text-k-black-40 text-sm">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
          <FieldLabel>{`${noun} name`}</FieldLabel>
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label={`${noun} name`}
            placeholder="Enter a name..."
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
      </div>
    </DialogShell>
  );
}
