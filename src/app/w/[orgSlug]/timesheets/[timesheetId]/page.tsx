import { notFound } from "next/navigation";
import { ItemTopBar } from "@/components/kitchen/item-top-bar";
import { TimesheetConnect } from "@/components/kitchen/timesheet-connect";
import { TimesheetEntries } from "@/components/kitchen/timesheet-entries";
import { TimesheetHeader } from "@/components/kitchen/timesheet-header";
import { requireFolderAccess } from "@/lib/access-guard";
import { getFolder, getTimesheet, getTimesheetEntries } from "@/lib/kitchen-data";
import { canEditTimesheets } from "@/lib/permissions";

export default async function TimesheetPage({
  params,
}: {
  params: Promise<{ orgSlug: string; timesheetId: string }>;
}) {
  const { timesheetId } = await params;
  const timesheet = await getTimesheet(timesheetId);
  if (!timesheet) notFound();

  const folder = await getFolder(timesheet.folderId);
  const me = await requireFolderAccess(folder);
  const canManage = me.kind === "member";
  const canEdit = canEditTimesheets(me);

  const entries = await getTimesheetEntries(timesheetId);
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemTopBar
        breadcrumb={folder?.name ?? ""}
        participants={[]}
        shareTitle={timesheet.name}
        resourceId={timesheetId}
        resourceType="timesheet"
        initialAccess={timesheet.access}
        roles={timesheet.roles}
        authorId={timesheet.authorId}
      />

      <TimesheetHeader
        timesheetId={timesheet.id}
        folderId={timesheet.folderId}
        name={timesheet.name}
        starred={timesheet.starred}
        totalHours={totalHours}
        canManage={canManage}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {canEdit ? (
          <TimesheetConnect
            timesheetId={timesheet.id}
            folderId={timesheet.folderId}
            timesheetName={timesheet.name}
            apiToken={timesheet.apiToken}
            apiConnectedAt={timesheet.apiConnectedAt}
          />
        ) : null}

        <TimesheetEntries
          timesheetId={timesheet.id}
          folderId={timesheet.folderId}
          entries={entries}
          canLog={canEdit}
        />
      </div>
    </div>
  );
}
