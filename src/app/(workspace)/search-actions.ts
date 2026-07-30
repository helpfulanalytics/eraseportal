"use server";

import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getFolders,
  getOrganizations,
  getPeople,
  getFolderItems,
} from "@/lib/kitchen-data";
import { itemHref } from "@/lib/kitchen-format";

export type SearchResult = {
  id: string;
  title: string;
  type:
    | "organization"
    | "person"
    | "folder"
    | "conversation"
    | "board"
    | "document"
    | "file"
    | "embed";
  url?: string;
  subtitle?: string;
};

async function requireUser() {
  const me = await getCurrentUser();
  if (!me) redirect("/signin");
  return me;
}

export async function searchWorkspaceAction(
  query: string,
  currentOrgSlug: string | null,
): Promise<SearchResult[]> {
  const me = await requireUser();
  if (!query || query.trim().length === 0) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  const add = (result: SearchResult) => {
    results.push(result);
  };

  // 1. Organizations (Only for members)
  let orgs: Awaited<ReturnType<typeof getOrganizations>> = [];
  if (me.kind === "member") {
    orgs = await getOrganizations();
    for (const org of orgs) {
      if (org.name.toLowerCase().includes(lowerQuery)) {
        add({
          id: org.id,
          title: org.name,
          type: "organization",
          url: `/w/${org.slug}`,
        });
      }
    }
  }

  const orgIdToSlug = new Map(orgs.map((o) => [o.id, o.slug]));

  // 2. People
  const people = await getPeople();
  for (const person of Object.values(people)) {
    if (person.name.toLowerCase().includes(lowerQuery) || person.handle.toLowerCase().includes(lowerQuery)) {
      add({
        id: person.id,
        title: person.name,
        type: "person",
        // No dedicated profile pages yet, so no URL.
      });
    }
  }

  // 3. Folders
  const foldersOpts = me.kind === "client" ? { organizationId: me.organizationId } : undefined;
  const folders = await getFolders(foldersOpts);

  for (const folder of folders) {
    if (folder.name.toLowerCase().includes(lowerQuery)) {
      let slug = currentOrgSlug;
      if (me.kind === "member" && folder.organizationId) {
        slug = orgIdToSlug.get(folder.organizationId) || currentOrgSlug;
      }
      add({
        id: folder.id,
        title: folder.name,
        type: "folder",
        url: slug ? `/w/${slug}/folders/${folder.id}` : undefined,
      });
    }

    // 4. Folder Items
    const items = await getFolderItems(folder.id);
    for (const item of items) {
      if (item.name.toLowerCase().includes(lowerQuery)) {
        let slug = currentOrgSlug;
        if (me.kind === "member" && folder.organizationId) {
          slug = orgIdToSlug.get(folder.organizationId) || currentOrgSlug;
        }

        if (slug) {
          let url: string | undefined;
          if (item.kind === "file" && "url" in item.meta && item.meta.url) {
            // It's a file with a direct download url
            url = item.meta.url;
          } else {
            url = itemHref(item, slug);
          }

          add({
            id: item.id,
            title: item.name,
            type: item.kind,
            url,
            subtitle: folder.name,
          });
        }
      }
    }
  }

  // Limit to top 50 results
  return results.slice(0, 50);
}
