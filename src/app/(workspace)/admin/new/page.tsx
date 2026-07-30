import { requireAdminPage } from "@/lib/access-guard";
import { NewProjectForm } from "@/components/kitchen/new-project-form";

/**
 * The "project creator" — admin-only. Restyled from a ported full-page form
 * (milestack's dashboard/projects/new), trimmed to what kitchen's model
 * actually has: an Organization plus its first Folder. Budget/Duration/USDC
 * fields from the source don't apply to an agency workspace tool and were
 * dropped rather than carried over as dead chrome.
 */
export default async function NewProjectPage() {
  await requireAdminPage();

  return (
    <div className="px-12 py-10">
      <NewProjectForm />
    </div>
  );
}
