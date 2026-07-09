/**
 * Formats a Stripe unix-seconds timestamp as an ISO date, e.g. "2026-07-07".
 */
export const formatStripeTimestamp = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toISOString().slice(0, 10);
