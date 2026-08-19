/**
 * The invite email, for both audiences.
 *
 * Lifted out of `(workspace)/actions.ts` when member invites arrived, so the
 * client flow and the member flow send the same thing rather than drifting
 * into two near-identical templates. The only difference between them is what
 * the invitee is being invited *to*: a client joins one organization, a member
 * joins the workspace — `destinationName` carries whichever it is.
 */
import { SITE_URL, sendEmail } from "./resend";
import { escapeHtml } from "../kitchen-format";

/**
 * Best-effort — a failed send must never fail the mutation it rides with.
 * The invite row is already written by the time this runs, so a bounced
 * email costs a "Resend invite" click, not a broken account.
 */
export async function sendInviteEmail(input: {
  to: string;
  personName: string;
  /** The organization's name for a client, the workspace's for a member. */
  destinationName: string;
  token: string;
  /** Changes the wording — a member is joining the team, not a client portal. */
  audience: "member" | "client";
}): Promise<void> {
  try {
    const link = `${SITE_URL}/invite/${input.token}`;
    const where = escapeHtml(input.destinationName);
    const invitation =
      input.audience === "member"
        ? `You've been invited to join the ${where} team.`
        : `You've been invited to ${where}'s workspace.`;

    await sendEmail({
      to: input.to,
      subject:
        input.audience === "member"
          ? `You're invited to join ${input.destinationName}`
          : `You're invited to ${input.destinationName}`,
      html: `
        <p>Hi ${escapeHtml(input.personName)},</p>
        <p>${invitation}</p>
        <p><a href="${link}">Set your password and get started</a></p>
        <p>This link expires in 7 days.</p>
      `,
    });
  } catch (cause) {
    console.error("Couldn't send invite email:", cause);
  }
}
