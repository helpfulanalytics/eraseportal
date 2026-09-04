import { redirect } from "next/navigation";
import { PageTitleTabs, SubTabs } from "@/components/kitchen/page-title";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { OrgNameField } from "@/components/kitchen/org-name-field";
import { DefaultClientAccessField } from "@/components/kitchen/default-client-access-field";
import { PortalLinkField } from "@/components/kitchen/portal-link-field";
import { NewOrgClientButton } from "@/components/kitchen/admin-dialog-buttons";
import { ResendInviteButton } from "@/components/kitchen/resend-invite-button";
import { requireOrgWorkspaceAccess } from "@/lib/access-guard";
import { getClients } from "@/lib/kitchen-data";
import type { ClientAccessLevel } from "@/lib/kitchen-types";

const TABS = ["general", "clients", "billing"] as const;
type Tab = (typeof TABS)[number];

/**
 * "Workspace" always means one org now — this replaced the old top-level
 * `/settings`, whose General tab renamed a single global workspace and
 * whose "Workspace URL" field was cosmetic (a `defaultValue` that saved
 * nowhere).
 *
 * The Clients tab was called "Members" and never listed a single member: it
 * has always been `getClients()` filtered to this org. Agency members are
 * workspace-wide and live at `/team`. Renaming it removes the collision now
 * that both surfaces exist; `?tab=members` still resolves here so old links
 * survive.
 */
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgSlug } = await params;
  const { tab } = await searchParams;
  // `members` is the tab's old name, kept as an alias so links that predate
  // the rename don't silently fall back to General.
  const requested = tab === "members" ? "clients" : tab;
  const active: Tab = TABS.includes(requested as Tab)
    ? (requested as Tab)
    : "general";

  const { organization, me } = await requireOrgWorkspaceAccess(orgSlug);
  // Org name, portal link, and the client roster are admin concerns — a
  // client has no reason to reach this page.
  if (me.kind !== "member") redirect(`/w/${orgSlug}`);

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[{ label: "Settings", href: `/w/${orgSlug}/settings`, active: true }]}
      />

      <SubTabs
        className="mt-4 border-k-black-06 border-b"
        tabs={TABS.map((t) => ({
          label: t[0].toUpperCase() + t.slice(1),
          href: t === "general" ? `/w/${orgSlug}/settings` : `/w/${orgSlug}/settings?tab=${t}`,
          active: t === active,
        }))}
      />

      <div className="mt-8 max-w-[640px]">
        {active === "general" ? (
          <General
            organizationId={organization.id}
            name={organization.name}
            orgSlug={orgSlug}
            defaultClientAccess={organization.defaultClientAccess ?? "view"}
          />
        ) : null}
        {active === "clients" ? <Clients organizationId={organization.id} /> : null}
        {active === "billing" ? <Billing /> : null}
      </div>
    </div>
  );
}

function General({
  organizationId,
  name,
  orgSlug,
  defaultClientAccess,
}: {
  organizationId: string;
  name: string;
  orgSlug: string;
  defaultClientAccess: ClientAccessLevel;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Field label="Project name" hint="Shown in the sidebar and on shared links.">
        <OrgNameField organizationId={organizationId} initial={name} />
      </Field>

      <Field label="Portal link" hint="Where this project's workspace lives.">
        <PortalLinkField path={`/w/${orgSlug}`} />
      </Field>

      <Field
        label="Default client access"
        hint="What invited clients can do unless changed per item."
      >
        <DefaultClientAccessField
          organizationId={organizationId}
          initial={defaultClientAccess}
        />
      </Field>
    </div>
  );
}

async function Clients({ organizationId }: { organizationId: string }) {
  const clients = (await getClients()).filter((c) => c.organizationId === organizationId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-k-black-40 text-md">
          Everyone at this project who can sign into the portal.
        </p>
        <NewOrgClientButton organizationId={organizationId} />
      </div>
      <ul className="flex flex-col">
        {clients.length === 0 ? (
          <li className="py-6 text-center text-k-black-40 text-md">
            No clients yet. Add one to send them an invite.
          </li>
        ) : (
          clients.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-3 border-k-black-06 border-b py-3"
            >
              <PersonAvatar personId={person.id} className="size-8" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-k-black-84 text-md">
                  {person.name}
                </div>
                <div className="truncate text-k-black-40 text-md">
                  {person.email}
                </div>
              </div>
              {person.uid ? (
                <span className="shrink-0 rounded bg-k-green-23 px-2 py-0.5 text-k-green-0e text-sm">
                  Active
                </span>
              ) : (
                <ResendInviteButton personId={person.id} />
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Billing() {
  return (
    <div className="rounded-xl border border-k-black-08 p-5">
      <div className="text-k-black-40 text-md">Current plan</div>
      <div className="mt-1 font-semibold text-k-black-84 text-section">Team</div>
      <p className="mt-2 text-k-black-56 text-md">
        3 seats · unlimited folders and client invites.
      </p>
      <button
        type="button"
        className="mt-4 flex h-8 items-center rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
      >
        Manage billing
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <div className="text-k-black-84 text-md">{label}</div>
        <div className="text-k-black-40 text-md">{hint}</div>
      </div>
      {children}
    </div>
  );
}
