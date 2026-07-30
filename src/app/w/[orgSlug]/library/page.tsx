import { PageTitleTabs } from "@/components/kitchen/page-title";
import { LibraryTable } from "@/components/kitchen/library-table";
import { getCurrentUser, getFolders, getLibraryFiles, getPeople } from "@/lib/kitchen-data";

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const me = await getCurrentUser();
  const isAdmin = me?.kind === "member";

  const [allFiles, people, folders] = await Promise.all([
    getLibraryFiles(),
    getPeople(),
    getFolders(isAdmin ? undefined : { organizationId: me?.organizationId }),
  ]);

  // Same join-through-folders scoping as /tasks — LibraryFile carries a
  // folderId but no organizationId of its own.
  const visibleFolderIds = new Set(folders.map((f) => f.id));
  const files = isAdmin ? allFiles : allFiles.filter((f) => visibleFolderIds.has(f.folderId));

  // Resolved here so the table doesn't need the whole people directory just
  // to print one name per row.
  const authors = Object.fromEntries(
    files.map((file) => [file.id, people[file.authorId]?.name ?? "—"]),
  );

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[{ label: "Library", href: `/w/${orgSlug}/library`, active: true }]}
      />
      <p className="mt-2 text-k-black-40 text-md">
        Every file in this organization — uploads and message attachments.
        Select one to preview it.
      </p>

      <LibraryTable files={files} authors={authors} />
    </div>
  );
}
