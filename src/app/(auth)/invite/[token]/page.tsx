import { InviteAcceptForm } from "@/components/invite-accept-form";
import { requireGuest } from "@/lib/auth-guard";
import { getInviteByToken, getOrganization, getPerson, isInviteExpired } from "@/lib/kitchen-data";

/**
 * Public — reached from the invite email, never linked from inside the app.
 * `requireGuest` bounces an already-signed-in visitor away, same as
 * sign-up/sign-in; accepting someone else's invite while signed in as
 * another account isn't a supported flow.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await requireGuest();
  const { token } = await params;

  const invite = await getInviteByToken(token);

  if (!invite) {
    return <InviteMessage title="This invite link isn't valid." />;
  }
  if (invite.usedAt) {
    return <InviteMessage title="This invite has already been used." body="Sign in instead." />;
  }
  if (isInviteExpired(invite)) {
    return (
      <InviteMessage
        title="This invite has expired."
        body="Ask whoever invited you to send a new one."
      />
    );
  }

  const [person, organization] = await Promise.all([
    getPerson(invite.personId),
    getOrganization(invite.organizationId),
  ]);

  if (!person || !organization) {
    return <InviteMessage title="This invite link isn't valid." />;
  }

  return (
    <InviteAcceptForm
      token={token}
      name={person.name}
      email={person.email}
      organizationName={organization.name}
    />
  );
}

function InviteMessage({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold tracking-tight">{title}</h1>
        {body ? <p className="mt-2 text-muted-foreground text-sm">{body}</p> : null}
      </div>
    </div>
  );
}
