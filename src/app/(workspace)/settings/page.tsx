import { PageTitleTabs, SubTabs } from "@/components/kitchen/page-title";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { getPeople, getWorkspace } from "@/lib/kitchen-data";

const TABS = ["general", "members", "billing"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "general";

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[{ label: "Settings", href: "/settings", active: true }]}
      />

      <SubTabs
        className="mt-4 border-k-black-06 border-b"
        tabs={TABS.map((t) => ({
          label: t[0].toUpperCase() + t.slice(1),
          href: t === "general" ? "/settings" : `/settings?tab=${t}`,
          active: t === active,
        }))}
      />

      <div className="mt-8 max-w-[640px]">
        {active === "general" ? <General /> : null}
        {active === "members" ? <Members /> : null}
        {active === "billing" ? <Billing /> : null}
      </div>
    </div>
  );
}

async function General() {
  const workspace = await getWorkspace();

  return (
    <div className="flex flex-col gap-6">
      <Field label="Workspace name" hint="Shown in the sidebar and on shared links.">
        <input
          defaultValue={workspace.name}
          className="h-8 w-full rounded-lg border border-k-black-08 px-3 text-k-black-84 text-md outline-none focus:border-k-blue"
        />
      </Field>

      <Field label="Workspace URL" hint="Clients reach your workspace at this address.">
        <div className="flex h-8 items-center rounded-lg border border-k-black-08 px-3 text-md">
          <span className="text-k-black-40">kitchen.local/</span>
          <input
            defaultValue="kea-marketing"
            className="min-w-0 flex-1 bg-transparent text-k-black-84 outline-none"
          />
        </div>
      </Field>

      <Field
        label="Default client access"
        hint="What invited clients can do unless changed per item."
      >
        <select className="h-8 w-full rounded-lg border border-k-black-08 bg-background px-2.5 text-k-black-84 text-md outline-none focus:border-k-blue">
          <option>Can view</option>
          <option>Can comment</option>
          <option>Can edit</option>
        </select>
      </Field>

      <div className="border-k-black-06 border-t pt-5">
        <button
          type="button"
          className="flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

async function Members() {
  const people = await getPeople();

  return (
    <ul className="flex flex-col">
      {Object.values(people).map((person) => (
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
          <span className="shrink-0 rounded bg-k-black-04 px-2 py-0.5 text-k-black-64 text-sm">
            {person.kind === "client" ? "Client" : "Member"}
          </span>
        </li>
      ))}
    </ul>
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
