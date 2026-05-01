/**
 * Email domains that unconditionally mark an account as "pro" regardless of
 * Stripe subscription state. Ported from Recoup-Agent-APIs/lib/consts.ts.
 */
export const ENTERPRISE_DOMAINS: ReadonlySet<string> = new Set([
  "recoupable.com",
  "rostrum.com",
  "spaceheatermusic.io",
  "fatbeats.com",
  "cantorarecords.net",
  "rostrumrecords.com",
]);
