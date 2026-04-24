/**
 * Comma-separated origins from `SUBSCRIPTION_CHECKOUT_SUCCESS_EXTRA_ORIGINS` for checkout success redirects.
 */
export function extraOriginsFromEnv(): string[] {
  const raw = process.env.SUBSCRIPTION_CHECKOUT_SUCCESS_EXTRA_ORIGINS;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map(s => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
