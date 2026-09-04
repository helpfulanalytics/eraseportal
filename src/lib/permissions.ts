/**
 * Who may do what.
 *
 * Pure predicates — no I/O, no `firebase-admin`, no `next/navigation`. That
 * keeps this importable from client components (same constraint
 * `kitchen-types.ts` documents for itself), so the Team page can grey out a
 * control using exactly the rule the server action re-checks. The UI reads
 * these to decide what to *offer*; the guards in `access-guard.ts` and the
 * `require*` helpers in the action files read them to decide what to *allow*.
 * Never only the former.
 */
import type { MemberRole, Person } from "./kitchen-types";

/**
 * The agency tier, or `null` for a client.
 *
 * Absence defaults to `"admin"` rather than `"member"`: every member that
 * existed before tiers could invite clients, create organizations and reach
 * everything, and reading them as the lowest tier would silently strip that
 * on deploy. `scripts/backfill-member-roles.ts` writes the field explicitly
 * and promotes one person to `owner`; until it runs, this default is what
 * holds the old behaviour in place.
 */
export function memberRoleOf(person: Person): MemberRole | null {
  if (person.kind !== "member") return null;
  return person.memberRole ?? "admin";
}

/** A person who hasn't been removed from the workspace. */
export function isActive(person: Person): boolean {
  return !person.deactivatedAt;
}

/** Reaching the Team page at all, and the invite/remove actions behind it. */
export function canManageTeam(me: Person): boolean {
  const role = memberRoleOf(me);
  return role === "owner" || role === "admin";
}

/** Creating organizations, and the org-level settings that come with them. */
export function canManageOrganizations(me: Person): boolean {
  return canManageTeam(me);
}

/**
 * Whether `me` may move `target` to `next`.
 *
 * Three rules, in order: nobody edits their own role (an admin can't
 * self-promote, and an owner can't demote themselves into an ownerless
 * workspace — that's what `transferOwnershipAction` is for); the `owner` tier
 * is owner-gated on both sides, so an admin can neither hand it out nor take
 * it away; and everything else needs plain team-management rights.
 */
export function canAssignRole(
  me: Person,
  target: Person,
  next: MemberRole,
): boolean {
  if (!canManageTeam(me)) return false;
  if (target.kind !== "member") return false;
  if (me.id === target.id) return false;

  const involvesOwner = next === "owner" || memberRoleOf(target) === "owner";
  if (involvesOwner) return memberRoleOf(me) === "owner";

  return true;
}

/**
 * Whether `me` may deactivate `target`. An owner is removable only by first
 * transferring ownership, which is deliberate — it makes losing the last
 * owner take two intentional steps rather than one.
 */
export function canRemoveMember(me: Person, target: Person): boolean {
  if (!canManageTeam(me)) return false;
  if (target.kind !== "member") return false;
  if (me.id === target.id) return false;
  return memberRoleOf(target) !== "owner";
}

/** Only an owner hands the seat on, and only to another active member. */
export function canTransferOwnership(me: Person, target: Person): boolean {
  return (
    memberRoleOf(me) === "owner" &&
    target.kind === "member" &&
    isActive(target) &&
    me.id !== target.id
  );
}

/**
 * Whether `me` may change sharing on a folder/board/document/embed/
 * conversation — the access mode and the per-person role map.
 *
 * Members pass outright, matching every other admin-shaped action in
 * `actions.ts`. A client passes only for something they created themselves or
 * hold `full` on; a `viewer`/`editor` grant is not itself a right to re-grant.
 * Callers must *also* have established that the resource is inside the
 * caller's organization — this predicate is pure and can't check that. See
 * `requireResourceManage`, which does both.
 */
export function canManageResource(
  me: Person,
  resource: { authorId?: string; roles?: Record<string, string> },
): boolean {
  if (me.kind === "member") return true;
  if (resource.authorId === me.id) return true;
  return resource.roles?.[me.id] === "full";
}

/** Ordered worst-to-best, for rendering a role `<select>` consistently. */
export const MEMBER_ROLES: readonly MemberRole[] = ["member", "admin", "owner"];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const MEMBER_ROLE_HINTS: Record<MemberRole, string> = {
  owner: "Full control, including who else is an owner.",
  admin: "Manages the team and creates projects.",
  member: "Works in projects and invites clients.",
};
