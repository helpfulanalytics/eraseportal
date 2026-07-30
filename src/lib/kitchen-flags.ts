/**
 * Feature flags for chrome that renders but isn't wired up yet (see
 * docs/handoff-2.md "Still chrome without function"). Flip a flag to `true`
 * once the feature behind it is real — the call site keeps working either
 * way, it just stops early-returning null.
 */
export const FLAGS = {
  /** ⌘K search overlay — no index behind it yet. */
  globalSearch: true,
  /** Share dialog beyond Copy Link (access toggle, invite list, Done). */
  shareDialog: false,
  /** Per-message React / Reply / More hover actions. */
  messageActions: false,
} as const;

export type FlagName = keyof typeof FLAGS;

export function isEnabled(flag: FlagName): boolean {
  return FLAGS[flag];
}
