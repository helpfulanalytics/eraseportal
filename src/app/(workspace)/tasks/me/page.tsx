import { DataTable, type Row } from "@/components/kitchen/data-table";
import { PageTitleTabs } from "@/components/kitchen/page-title";
import { getCurrentUser, getFolders, getTasks } from "@/lib/kitchen-data";
import { formatShortDate } from "@/lib/kitchen-format";

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_TINT: Record<string, string> = {
  todo: "bg-k-black-06 text-k-black-72",
  in_progress: "bg-k-blue-08 text-k-blue",
  done: "bg-k-green-23 text-k-green-0e",
};

export default async function MyTasksPage() {
  const [allTasks, folders, me] = await Promise.all([
    getTasks(),
    getFolders(),
    getCurrentUser(),
  ]);
  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  const mine = allTasks.filter(
    (t) => t.assigneeId === me?.id && !t.completed,
  ).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const rows: Row[] = mine.map((task) => ({
    id: task.id,
    href: task.folderId ? `/folders/${task.folderId}` : undefined,
    cells: {
      title: <span className="text-k-black-84 text-md">{task.title}</span>,
      status: (
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-2xs ${
            STATUS_TINT[task.status] ?? "bg-k-black-06 text-k-black-72"
          }`}
        >
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
      ),
      folder: task.folderId ? (folderName.get(task.folderId) ?? "—") : "—",
      due: task.dueDate ? formatShortDate(task.dueDate) : "—",
    },
  }));

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[{ label: "My Tasks", href: "/tasks/me", active: true }]}
      />
      <DataTable
        className="mt-7"
        columns={[
          { key: "title", label: "Task" },
          { key: "status", label: "Status", width: "120px" },
          { key: "folder", label: "Folder", width: "180px" },
          { key: "due", label: "Due", width: "120px", sorted: "asc" },
        ]}
        rows={rows}
        empty="Nothing assigned to you."
      />
    </div>
  );
}
