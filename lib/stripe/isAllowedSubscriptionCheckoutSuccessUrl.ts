/**
 * Origins allowed for `successUrl` on subscription checkout (open-redirect guard).
 * Keep in sync with chat hosts; extend here when new first-party app origins are added.
 */
const SUBSCRIPTION_CHECKOUT_SUCCESS_ALLOWED_ORIGINS = [
  "https://chat.recoupable.com",
  "http://localhost:3000",
  "http://localhost:3001",
] as const;

/**
 * Returns whether `successUrl` uses an allowed origin for post-checkout redirect.
 */
export function isAllowedSubscriptionCheckoutSuccessUrl(successUrl: string): boolean {
  try {
    const parsed = new URL(successUrl);
    return (SUBSCRIPTION_CHECKOUT_SUCCESS_ALLOWED_ORIGINS as readonly string[]).includes(
      parsed.origin,
    );
  } catch {
    return false;
  }
}
