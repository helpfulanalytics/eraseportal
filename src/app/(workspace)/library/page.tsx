import { Columns3Icon, SearchIcon, UploadIcon } from "lucide-react";
import { DataTable, type Row } from "@/components/kitchen/data-table";
import { PageTitleTabs } from "@/components/kitchen/page-title";
import { FileThumb } from "@/components/kitchen/file-thumb";
import {
  formatBytes,
  formatShortDate,
  getLibraryFiles,
  getPerson,
} from "@/lib/kitchen-data";

export default function LibraryPage() {
  const files = getLibraryFiles();

  const rows: Row[] = files.map((file) => ({
    id: `${file.source}-${file.id}`,
    cells: {
      name: (
        <div className="flex min-w-0 items-center gap-3">
          <FileThumb />
          <div className="min-w-0">
            <div className="truncate text-k-black-84 text-md">{file.name}</div>
            <div className="truncate text-k-black-40 text-md">
              {file.label} • {formatBytes(file.bytes)}
            </div>
          </div>
        </div>
      ),
      source: <span className="truncate">{file.source}</span>,
      author: getPerson(file.authorId)?.name ?? "—",
      created: formatShortDate(file.createdAt),
    },
  }));

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[{ label: "Library", href: "/library", active: true }]}
      />
      <p className="mt-2 text-k-black-40 text-md">
        Every file across the workspace — uploads and message attachments.
      </p>

      <div className="mt-7 flex items-center gap-2">
        <div className="flex h-8 w-56 items-center gap-2 rounded-lg border border-k-black-08 px-3 text-k-gray-ad text-md">
          <SearchIcon className="size-3.5 shrink-0" strokeWidth={1.7} />
          <span>
            Search {files.length} {files.length === 1 ? "file" : "files"}...
          </span>
        </div>
        <button
          type="button"
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
        >
          <UploadIcon className="size-3.5" strokeWidth={1.8} />
          Upload
        </button>
      </div>

      <DataTable
        className="mt-7"
        columns={[
          { key: "name", label: "Name" },
          { key: "source", label: "Location", width: "260px" },
          { key: "author", label: "Author", width: "160px" },
          { key: "created", label: "Created", width: "120px" },
        ]}
        rows={rows}
        empty="No files yet."
        headerAction={
          <button
            type="button"
            aria-label="Configure columns"
            className="flex size-6 items-center justify-center rounded-md text-k-black-24 transition-colors hover:bg-k-black-04 hover:text-k-black-72"
          >
            <Columns3Icon className="size-4" strokeWidth={1.7} />
          </button>
        }
      />
    </div>
  );
}
