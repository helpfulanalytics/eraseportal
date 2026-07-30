"use server";

/**
 * Reads for the Inbox panel.
 *
 * The Inbox is shell state, not a route: it opens over whatever page you're
 * on and survives navigation. That rules out fetching it in the workspace
 * layout — the layout re-renders on every navigation, and three of these four
 * tabs are collection scans that nobody asked for while reading a document.
 * So the panel loads its own rows the first time it's opened, and only for
 * the tab being looked at.
 *
 * Separate from `actions.ts` because these are reads. That file's contract is
 * "every export mutates and takes its actor from the session"; mixing a fetch
 * into it would weaken the rule that makes it easy to audit.
 */
import { requireInboxScope } from "@/lib/access-guard";
import {
  getLibraryFiles,
  getRecentActivity,
  getRecentMessages,
  getTasks,
} from "@/lib/kitchen-data";
import type {
  InboxActivity,
  InboxMessage,
  LibraryFile,
  Task,
} from "@/lib/kitchen-types";

export type InboxTab = "chats" | "tasks" | "files" | "updates";

/**
 * A tab's rows, discriminated so the panel can render one shape per tab
 * without a cast. No people directory rides along: the shell sits inside
 * `WorkspaceProvider`, so the panel reads authors and avatars from context
 * the same way every other client component does.
 */
export type InboxPayload =
  | { tab: "chats"; rows: InboxMessage[] }
  | { tab: "tasks"; rows: Array<Task & { folderName: string }> }
  | { tab: "files"; rows: LibraryFile[] }
  | { tab: "updates"; rows: InboxActivity[] };

const PAGE = 40;

export async function loadInboxAction(
  orgSlug: string,
  tab: InboxTab,
): Promise<InboxPayload> {
  const { organizationId, folderIds, folders } = await requireInboxScope(orgSlug);
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));

  switch (tab) {
    case "chats":
      return { tab, rows: await getRecentMessages({ organizationId, limit: PAGE }) };

    case "updates":
      return { tab, rows: await getRecentActivity({ organizationId, limit: PAGE }) };

    case "tasks": {
      // A task's `folderId` is optional — an unfiled task belongs to the
      // workspace, not to an organization, so it never appears in an org's
      // Inbox. Open work first, then soonest due date.
      const tasks = await getTasks();
      const rows = tasks
        .filter((task) => task.folderId && folderIds.has(task.folderId))
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        })
        .slice(0, PAGE)
        .map((task) => ({
          ...task,
          folderName: folderNames.get(task.folderId ?? "") ?? "",
        }));
      return { tab, rows };
    }

    case "files": {
      const files = await getLibraryFiles();
      return {
        tab,
        rows: files.filter((file) => folderIds.has(file.folderId)).slice(0, PAGE),
      };
    }
  }
}
