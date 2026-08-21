"use server";

/**
 * Agency team management — the member half of the lifecycle that
 * `createClientAction` and friends already provide for clients.
 *
 * Split out of `actions.ts` (already 1100+ lines) the same way
 * `share-actions.ts`, `inbox-actions.ts` and `search-actions.ts` are: one
 * concern per file. The two lifecycles are deliberately near-identical —
 * create a Person, mint a tokenized invite, email a link, let
 * `acceptInviteAction` close the loop — so that there's one flow to reason
 * about rather than two.
 *
 * Every rule these actions enforce lives in `permissions.ts` and is enforced
 * here on the server. The Team page reads the same predicates to decide what
 * to render, but that's a convenience, not the boundary.
 */
import { revalidatePath } from "next/cache";
import { adminAuth } from "@/lib/firebase/admin";
import { sendInviteEmail } from "@/lib/email/templates";
import {
  createInvite,
  createMember,
  deactivateMember,
  getCurrentUser,
  getMembers,
  getPerson,
  getPersonByEmail,
  getWorkspace,
  reactivateMember,
  setMemberRole,
  transferOwnership,
} from "@/lib/kitchen-data";
import {
  canAssignRole,
  canManageTeam,
  canRemoveMember,
  canTransferOwnership,
  memberRoleOf,
} from "@/lib/permissions";
import type { MemberRole, Person } from "@/lib/kitchen-types";

/** Same email shape `createClientAction` validates against. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ROLES: readonly MemberRole[] = ["owner", "admin", "member"];

/**
 * The gate for everything in this file. `requireAdmin` in `actions.ts` only
 * asks whether you're a member at all; managing the team asks for the tier on
 * top of it.
 */
async function requireTeamAdmin(): Promise<Person> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");
  if (!canManageTeam(me)) {
    throw new Error("You don't have permission to manage the team.");
  }
  return me;
}

/** Narrows an unvalidated string off the wire — the select is not a promise. */
function parseRole(role: string): MemberRole {
  if (!ROLES.includes(role as MemberRole)) {
    throw new Error("That isn't a role.");
  }
  return role as MemberRole;
}

/**
 * Loads a person and asserts they're an agency member, so no action here can
 * be pointed at a client id and used to sidestep the client-side rules.
 */
async function requireMember(personId: string): Promise<Person> {
  const person = await getPerson(personId);
  if (!person || person.kind !== "member") {
    throw new Error("That team member doesn't exist.");
  }
  return person;
}

/* ---- invites ---------------------------------------------------------- */

/**
 * Creates the member's directory entry and emails them a link to claim it.
 *
 * Nobody may invite straight to `owner`: there's exactly one, and it moves
 * only through `transferOwnershipAction`. `canAssignRole` can't express that
 * here — it compares against an existing target, and there isn't one yet — so
 * the check is explicit.
 */
export async function inviteMemberAction(
  name: string,
  email: string,
  role: string,
): Promise<string> {
  const me = await requireTeamAdmin();
  const memberRole = parseRole(role);

  if (memberRole === "owner") {
    throw new Error(
      "There can only be one owner. Invite them as an admin, then transfer ownership.",
    );
  }
  if (memberRole === "admin" && memberRoleOf(me) !== "owner") {
    throw new Error("Only the owner can invite admins.");
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) throw new Error("A team member needs a name.");
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    throw new Error("That doesn't look like an email address.");
  }

  // A second Person on the same address would make the email-adoption branch
  // in `getCurrentUser` resolve to whichever the query returned first.
  const existing = await getPersonByEmail(trimmedEmail);
  if (existing) {
    throw new Error(
      existing.deactivatedAt
        ? "Someone with that email was removed from the workspace. Restore them instead."
        : "Someone with that email is already in the workspace.",
    );
  }

  const [person, workspace] = await Promise.all([
    createMember({ name: trimmedName, email: trimmedEmail, memberRole }),
    getWorkspace(),
  ]);

  const invite = await createInvite({
    personId: person.id,
    memberRole,
    email: trimmedEmail,
    invitedByPersonId: me.id,
  });

  await sendInviteEmail({
    to: trimmedEmail,
    personName: trimmedName,
    destinationName: workspace.name,
    token: invite.token,
    audience: "member",
    invitedByName: me.name,
  });

  revalidatePath("/team");
  return person.id;
}

/** A fresh token; the member's Person record is left alone. */
export async function resendMemberInviteAction(personId: string): Promise<void> {
  const me = await requireTeamAdmin();
  const person = await requireMember(personId);
  if (person.uid) {
    throw new Error("They've already signed in — there's nothing to resend.");
  }

  const [workspace, invite] = await Promise.all([
    getWorkspace(),
    createInvite({
      personId: person.id,
      memberRole: memberRoleOf(person) ?? "member",
      email: person.email,
      invitedByPersonId: me.id,
    }),
  ]);

  await sendInviteEmail({
    to: person.email,
    personName: person.name,
    destinationName: workspace.name,
    token: invite.token,
    audience: "member",
    invitedByName: me.name,
  });
}

/* ---- roles and removal ------------------------------------------------ */

export async function updateMemberRoleAction(
  personId: string,
  role: string,
): Promise<void> {
  const me = await requireTeamAdmin();
  const target = await requireMember(personId);
  const next = parseRole(role);

  if (!canAssignRole(me, target, next)) {
    throw new Error("You don't have permission to change that person's role.");
  }

  await setMemberRole(personId, next);
  revalidatePath("/team");
}

/**
 * Removal is a soft delete — see `Person.deactivatedAt`. Revoking their
 * refresh tokens is what makes it take effect immediately: `getSessionUser`
 * verifies with `checkRevoked: true`, so an already-issued session cookie
 * stops verifying on their very next request rather than lingering for up to
 * the cookie's 14 days.
 */
export async function removeMemberAction(personId: string): Promise<void> {
  const me = await requireTeamAdmin();
  const target = await requireMember(personId);

  if (!canRemoveMember(me, target)) {
    throw new Error("You don't have permission to remove that person.");
  }

  await deactivateMember(personId);

  if (target.uid) {
    try {
      await adminAuth().revokeRefreshTokens(target.uid);
    } catch (cause) {
      // Best-effort, and safe to swallow: `getCurrentUser` refuses anyone
      // carrying `deactivatedAt` regardless, so the worst case is that their
      // current page render survives until they navigate.
      console.error("Couldn't revoke sessions for removed member:", cause);
    }
  }

  revalidatePath("/team");
}

/** Undoes a removal. The person keeps the tier they had. */
export async function restoreMemberAction(personId: string): Promise<void> {
  const me = await requireTeamAdmin();
  const target = await requireMember(personId);
  if (!target.deactivatedAt) return;
  if (memberRoleOf(target) === "admin" && memberRoleOf(me) !== "owner") {
    throw new Error("Only the owner can restore an admin.");
  }

  await reactivateMember(personId);
  revalidatePath("/team");
}

/**
 * Hands the owner seat on. Promote-and-demote is one batched write in
 * `transferOwnership`, so the workspace is never briefly ownerless or
 * two-owned.
 */
export async function transferOwnershipAction(personId: string): Promise<void> {
  const me = await requireTeamAdmin();
  const target = await requireMember(personId);

  if (!canTransferOwnership(me, target)) {
    throw new Error("Only the owner can transfer ownership.");
  }
  if (!target.uid) {
    throw new Error(
      "They need to accept their invite and sign in before they can be owner.",
    );
  }

  await transferOwnership({ fromPersonId: me.id, toPersonId: target.id });
  revalidatePath("/team");
}

/**
 * Read side for the Team page. Lives here rather than being called straight
 * from the page so the tier check and the read stay in one place.
 */
export async function listTeamAction(): Promise<Person[]> {
  await requireTeamAdmin();
  return getMembers();
}
