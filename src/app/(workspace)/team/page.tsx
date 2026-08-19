import { PageTitleTabs } from "@/components/kitchen/page-title";
import { InviteMemberButton } from "@/components/kitchen/invite-member-button";
import { TeamMemberRow } from "@/components/kitchen/team-member-row";
import { requireTeamPage } from "@/lib/access-guard";
import { getMembers, getWorkspace } from "@/lib/kitchen-data";
import { isActive, memberRoleOf } from "@/lib/permissions";

/**
 * The agency roster — everyone who works *at* the agency, as opposed to the
 * clients each organization's Settings page lists.
 *
 * Top-level rather than under `/w/[orgSlug]` because a member belongs to the
 * workspace, not to one organization: scoping this page to an org would ask
 * "which client's portal do I manage the agency from?", which has no answer.
 * That's also why the org Settings tab is called Clients — it always did list
 * clients, it just called them members.
 *
 * `requireTeamPage` redirects a plain `member` back to the dashboard rather
 * than 404ing. The page's existence isn't a secret; the roster is.
 */
export default async function TeamPage() {
  const me = await requireTeamPage();
  const [members, workspace] = await Promise.all([getMembers(), getWorkspace()]);

  // Removed people sort last: the list is for managing who's here, and a
  // restorable ex-member is a footnote rather than a peer.
  const active = members.filter(isActive);
  const removed = members.filter((person) => !isActive(person));

  return (
    <div className="px-12 py-10">
      <PageTitleTabs tabs={[{ label: "Team", href: "/team", active: true }]} />

      <div className="mt-8 max-w-[640px]">
        <div className="flex items-center justify-between">
          <p className="text-k-black-40 text-md">
            Everyone at {workspace.name}. Clients live under each
            organization&apos;s settings.
          </p>
          <InviteMemberButton canInviteAdmins={memberRoleOf(me) === "owner"} />
        </div>

        <ul className="mt-4 flex flex-col">
          {active.map((person) => (
            <TeamMemberRow key={person.id} me={me} person={person} />
          ))}
        </ul>

        {removed.length > 0 ? (
          <>
            <h2 className="mt-8 text-k-black-40 text-md">Removed</h2>
            <ul className="mt-2 flex flex-col">
              {removed.map((person) => (
                <TeamMemberRow key={person.id} me={me} person={person} />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
