import {
  ArrowUpDownIcon,
  ListFilterIcon,
  ListIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { DataTable, type Row } from "@/components/kitchen/data-table";
import { PageTitleTabs, SubTabs } from "@/components/kitchen/page-title";
import { NewTaskButton } from "@/components/kitchen/new-task-button";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { TaskCalendar } from "@/components/kitchen/task-calendar";
import { TaskCheckbox } from "@/components/kitchen/task-checkbox";
import { getCurrentUser, getFolders, getPeople, getTasks } from "@/lib/kitchen-data";
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

/**
 * View state lives in the URL — `?view=all_tasks&layout=table&order=due_date`
 * — so a filtered board is shareable. Next 16 hands searchParams over as a
 * Promise.
 */
export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ view?: string; layout?: string; order?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const view = sp.view === "completed" ? "completed" : "all_tasks";
  const layout = sp.layout === "calendar" ? "calendar" : "table";
  const order = sp.order ?? "due_date";

  const me = await getCurrentUser();
  const isAdmin = me?.kind === "member";

  const [allTasks, people, folders] = await Promise.all([
    getTasks(),
    getPeople(),
    getFolders(isAdmin ? undefined : { organizationId: me?.organizationId }),
  ]);

  // Tasks carry a folderId but no organizationId of their own — scope a
  // client's view by joining through the folders they can already reach.
  const visibleFolderIds = new Set(folders.map((f) => f.id));
  const orgTasks = isAdmin
    ? allTasks
    : allTasks.filter((t) => t.folderId && visibleFolderIds.has(t.folderId));

  const tasks = orgTasks.filter((t) =>
    view === "completed" ? t.completed : !t.completed,
  );

  const href = (next: Record<string, string>) => {
    const params = new URLSearchParams({ view, layout, order, ...next });
    return `/w/${orgSlug}/tasks?${params.toString()}`;
  };

  // Sort honours the `order` param; due_date is the sheet's default.
  const sorted = [...tasks].sort((a, b) =>
    order === "title"
      ? a.title.localeCompare(b.title)
      : (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
  );

  const rows: Row[] = sorted.map((task) => ({
    id: task.id,
    cells: {
      title: (
        <span className="flex min-w-0 items-center gap-2.5">
          <TaskCheckbox
            taskId={task.id}
            completed={task.completed}
            title={task.title}
          />
          <span className="truncate text-k-black-84 text-md">{task.title}</span>
        </span>
      ),
      status: (
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-2xs ${
            STATUS_TINT[task.status] ?? "bg-k-black-06 text-k-black-72"
          }`}
        >
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
      ),
      assignee: task.assigneeId ? (
        <span className="flex items-center gap-2">
          <PersonAvatar personId={task.assigneeId} className="size-5" />
          <span className="truncate">{people[task.assigneeId ?? ""]?.name}</span>
        </span>
      ) : (
        "—"
      ),
      due: task.dueDate ? formatShortDate(task.dueDate) : "—",
    },
  }));

  return (
    <div className="px-12 py-10">
      <div className="flex items-start">
        <PageTitleTabs
          tabs={[
            {
              label: "All Tasks",
              href: href({ view: "all_tasks" }),
              active: view === "all_tasks",
            },
            {
              label: "Completed",
              href: href({ view: "completed" }),
              active: view === "completed",
            },
          ]}
        />

        <div className="ml-auto flex items-center gap-2 pt-2">
          <NewTaskButton folders={folders.map((f) => ({ id: f.id, name: f.name }))} />
          <ToolbarButton label="Filter">
            <ListFilterIcon className="size-4" strokeWidth={1.7} />
          </ToolbarButton>
          <ToolbarButton label="Sort">
            <ArrowUpDownIcon className="size-4" strokeWidth={1.7} />
          </ToolbarButton>
          <ToolbarButton label="Layout">
            <ListIcon className="size-4" strokeWidth={1.7} />
          </ToolbarButton>
          <ToolbarButton label="More">
            <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
          </ToolbarButton>
        </div>
      </div>

      <SubTabs
        className="mt-4"
        tabs={[
          {
            label: "Table",
            href: href({ layout: "table" }),
            active: layout === "table",
          },
          {
            label: "Calendar",
            href: href({ layout: "calendar" }),
            active: layout === "calendar",
          },
        ]}
      />

      {layout === "calendar" ? (
        <div className="mt-6">
          <TaskCalendar tasks={tasks} />
        </div>
      ) : (
        <DataTable
          className="mt-6"
          columns={[
            { key: "title", label: "Task" },
            { key: "status", label: "Status", width: "120px" },
            { key: "assignee", label: "Assignee", width: "180px" },
            {
              key: "due",
              label: "Due",
              width: "120px",
              sorted: order === "due_date" ? "asc" : undefined,
            },
          ]}
          rows={rows}
          empty={
            view === "completed" ? "Nothing completed yet." : "No open tasks."
          }
        />
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-k-blue transition-colors hover:bg-k-blue-08"
    >
      {children}
    </button>
  );
}
