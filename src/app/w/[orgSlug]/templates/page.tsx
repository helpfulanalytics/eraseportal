import {
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
} from "lucide-react";
import { PageTitleTabs } from "@/components/kitchen/page-title";
import { getTemplates } from "@/lib/kitchen-data";

const CONTENT_ICON: Record<string, React.ElementType> = {
  Conversation: MessageSquareIcon,
  Board: LayoutTemplateIcon,
  Document: FileTextIcon,
  Embed: LinkIcon,
  Files: FolderIcon,
};

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const templates = await getTemplates();

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[{ label: "Templates", href: `/w/${orgSlug}/templates`, active: true }]}
      />
      <p className="mt-2 text-k-black-40 text-md">
        Create folders in a snap — each template starts a folder pre-filled with
        the items below.
      </p>

      <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              className="flex h-full w-full flex-col rounded-xl border border-k-black-08 p-4 text-left transition-colors hover:border-k-black-12 hover:bg-k-black-02"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-k-yellow-16">
                <FolderIcon
                  className="size-4.5 fill-k-yellow text-k-yellow"
                  strokeWidth={1.4}
                />
              </span>
              <span className="mt-3 block font-medium text-k-black-84 text-md">
                {template.name}
              </span>
              <span className="mt-1 block text-k-black-40 text-md">
                {template.description}
              </span>

              <span className="mt-4 flex flex-wrap gap-1.5">
                {template.contents.map((content) => {
                  const Icon = CONTENT_ICON[content] ?? FolderIcon;
                  return (
                    <span
                      key={content}
                      className="flex items-center gap-1 rounded bg-k-black-04 px-1.5 py-0.5 text-2xs text-k-black-64"
                    >
                      <Icon className="size-3" strokeWidth={1.7} />
                      {content}
                    </span>
                  );
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
