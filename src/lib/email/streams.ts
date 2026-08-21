/**
 * Sender identities, one per kind of thing the product emails about.
 *
 * Before this existed everything went out as `invites@erasefriction.com`, so
 * a file-upload notification arrived from a sender called "invites" — wrong
 * on its face, and it gave the recipient no way to filter or mute one kind of
 * mail without muting all of it.
 *
 * **Every stream is a local-part on the one authenticated domain.** That is
 * the deliberate part. Reputation at Gmail and Outlook accrues to the domain
 * (and to the DKIM `d=`), so splitting streams across *addresses* costs
 * nothing, while splitting them across *domains* would hand each new domain a
 * cold, unwarmed reputation and land the mail in spam. See `docs/email.md`.
 */
import { PRODUCT_NAME, PRODUCT_SHORT, SENDING_DOMAIN } from "./brand";
import type { AccentName } from "./brand";

export type StreamName = "invites" | "files" | "messages" | "tasks";

interface Stream {
  /** Local-part of the From address. */
  localPart: string;
  /** Used when no human is the actor — system mail, or an actor we can't name. */
  displayName: string;
  /**
   * `List-Id`, so a recipient can build one filter that catches every mail in
   * this stream regardless of who triggered it, and so Gmail/Apple Mail can
   * group them.
   */
  listId: string;
  /** Resend tag value, for per-stream delivery and engagement stats. */
  tag: string;
  /**
   * Whether the stream advertises `List-Unsubscribe`.
   *
   * Off for invites: an invite is a one-shot transactional message the
   * recipient asked a person for, and offering to unsubscribe from it would
   * be offering to break their own account access. On for the three activity
   * streams, which are the recurring ones.
   */
  unsubscribable: boolean;
}

const STREAMS: Record<StreamName, Stream> = {
  invites: {
    localPart: "invites",
    displayName: PRODUCT_NAME,
    listId: "invites",
    tag: "invites",
    unsubscribable: false,
  },
  files: {
    localPart: "files",
    displayName: `${PRODUCT_SHORT} Files`,
    listId: "files",
    tag: "files",
    unsubscribable: true,
  },
  messages: {
    localPart: "messages",
    displayName: `${PRODUCT_SHORT} Messages`,
    listId: "messages",
    tag: "messages",
    unsubscribable: true,
  },
  tasks: {
    localPart: "tasks",
    displayName: `${PRODUCT_SHORT} Tasks`,
    listId: "tasks",
    tag: "tasks",
    unsubscribable: true,
  },
};

export function streamAddress(name: StreamName): string {
  return `${STREAMS[name].localPart}@${SENDING_DOMAIN}`;
}

export function streamListId(name: StreamName): string {
  return `<${STREAMS[name].listId}.${SENDING_DOMAIN}>`;
}

export function streamTag(name: StreamName): string {
  return STREAMS[name].tag;
}

export function streamIsUnsubscribable(name: StreamName): boolean {
  return STREAMS[name].unsubscribable;
}

/**
 * A display name is a header value, and `name` here comes from a user-editable
 * `Person.name`. A CR or LF in it would let that person inject arbitrary
 * headers, so they're stripped rather than escaped; quotes and backslashes are
 * escaped because the result is emitted as a quoted string.
 */
function quoteDisplayName(name: string): string {
  const clean = name
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\]/g, (c) => `\\${c}`)
    .trim()
    .slice(0, 78);
  return `"${clean}"`;
}

/**
 * The `From` header.
 *
 * When a person triggered the mail their name leads — "Brooks Conkle via
 * Erase Friction" — which is the single biggest readability win in a crowded
 * inbox: the subject line already says what happened, so the sender column
 * is free to say *who*. The `via` suffix is what keeps it honest, and it's the
 * convention Gmail itself appends when a domain sends on another's behalf.
 */
export function streamFrom(name: StreamName, actorName?: string): string {
  const address = streamAddress(name);
  const display = actorName?.trim()
    ? `${actorName.trim()} via ${PRODUCT_SHORT}`
    : STREAMS[name].displayName;
  return `${quoteDisplayName(display)} <${address}>`;
}

/** Accent used by the template's eyebrow rule, keyed by stream. */
export const STREAM_ACCENT: Record<StreamName, AccentName> = {
  invites: "blue",
  files: "purple",
  messages: "blue",
  tasks: "amber",
};
