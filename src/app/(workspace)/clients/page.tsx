import { Building2Icon, PlusIcon, SearchIcon, UsersIcon, Columns3Icon, ChevronDownIcon } from "lucide-react";
import { DataTable, type Column, type Row } from "@/components/kitchen/data-table";
import { PageTitleTabs } from "@/components/kitchen/page-title";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { getClients, getCompanies } from "@/lib/kitchen-data";
import { formatShortDate } from "@/lib/kitchen-format";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showCompanies = tab === "companies";
  const [clients, companies] = await Promise.all([getClients(), getCompanies()]);
  const count = showCompanies ? companies.length : clients.length;

  const columns: Column[] = showCompanies
    ? [
        { key: "name", label: "Name", sorted: "asc" },
        { key: "domain", label: "Domain", width: "240px" },
        { key: "people", label: "People", width: "100px", align: "right" },
        { key: "created", label: "Created", width: "120px" },
      ]
    : [
        { key: "name", label: "Name", sorted: "asc" },
        { key: "email", label: "Email", width: "240px" },
        { key: "created", label: "Created", width: "120px" },
      ];

  const rows: Row[] = showCompanies
    ? companies.map((company) => ({
        id: company.id,
        cells: {
          name: (
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-k-black-06 text-k-black-64">
                <Building2Icon className="size-3.5" strokeWidth={1.7} />
              </span>
              <span className="truncate text-k-black-84 text-md">
                {company.name}
              </span>
            </div>
          ),
          domain: <span className="truncate">{company.domain}</span>,
          people: company.clientIds.length,
          created: formatShortDate(company.createdAt),
        },
      }))
    : clients.map((client) => ({
        id: client.id,
        cells: {
          name: (
            <div className="flex min-w-0 items-center gap-3">
              <PersonAvatar personId={client.id} className="size-6" />
              <span className="truncate text-k-black-84 text-md">
                {client.name}
              </span>
            </div>
          ),
          email: <span className="truncate">{client.email}</span>,
          // Mock records predate the thread; a fixed date keeps the row stable.
          created: formatShortDate("2026-03-26"),
        },
      }));

  return (
    <div className="px-12 py-10">
      <PageTitleTabs
        tabs={[
          {
            label: "Clients",
            href: "/clients",
            active: !showCompanies,
            icon: <UsersIcon className="size-6" strokeWidth={1.7} />,
          },
          {
            label: "Companies",
            href: "/clients?tab=companies",
            active: showCompanies,
            icon: <Building2Icon className="size-6" strokeWidth={1.7} />,
          },
        ]}
      />

      <div className="mt-7 flex items-center gap-2">
        <div className="flex h-8 w-56 items-center gap-2 rounded-lg border border-k-black-08 px-3 text-k-gray-ad text-md">
          <SearchIcon className="size-3.5 shrink-0" strokeWidth={1.7} />
          <span>
            Search {count}{" "}
            {showCompanies
              ? count === 1
                ? "company"
                : "companies"
              : count === 1
                ? "client"
                : "clients"}
            ...
          </span>
        </div>
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-lg bg-k-black-04 px-3 text-k-black-84 text-md transition-colors hover:bg-k-black-06"
        >
          Created
          <ChevronDownIcon className="size-3.5 opacity-50" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
        >
          <PlusIcon className="size-3.5" strokeWidth={1.8} />
          Create {showCompanies ? "Company" : "Client"}
        </button>
      </div>

      <DataTable
        className="mt-7"
        columns={columns}
        rows={rows}
        empty={showCompanies ? "No companies yet." : "No clients yet."}
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

      {rows.length > 0 ? (
        <p className="mt-4 text-k-black-40 text-md">
          1–{rows.length} of {rows.length}
        </p>
      ) : null}
    </div>
  );
}
