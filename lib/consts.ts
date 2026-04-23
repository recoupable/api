/**
 * Re-export all constants from lib/const.ts for compatibility with
 * code migrated from Recoup-Chat that imports from "@/lib/consts"
 */
export * from "./const";

// Additional constants needed for evals that are specific to Recoup-Chat
export const NEW_API_BASE_URL = "https://recoup-api.vercel.app";

/**
 * Email domains that grant enterprise-tier access.
 *
 * Used by `isEnterprise()` to short-circuit the Stripe lookup in
 * `GET /api/accounts/{id}/subscription`: accounts whose emails match any
 * of these domains are treated as paid without needing an active Stripe
 * subscription. Ported verbatim from the legacy Express service to
 * preserve behaviour.
 */
export const ENTERPRISE_DOMAINS: ReadonlySet<string> = new Set([
  "recoupable.com",
  "rostrum.com",
  "spaceheatermusic.io",
  "fatbeats.com",
  "cantorarecords.net",
  "rostrumrecords.com",
]);
