import { SiteError } from "../SiteError";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
/** Fresh read using the existing paid-site rule; no per-instance fan-request cache. */
export async function readPaidSiteSubscription(
  ownerId: string,
  options: { throwOnError?: boolean } = {},
) {
  const eligible = (subscription: Awaited<ReturnType<typeof getActiveSubscriptions>>[number]) =>
    subscription.status === "active" &&
    subscription.items.data.some(item => (item.price.unit_amount ?? 0) > 0);
  try {
    const subscriptions = options.throwOnError
      ? await getActiveSubscriptions(ownerId, eligible, { throwOnError: true })
      : await getActiveSubscriptions(ownerId, eligible);
    return subscriptions.some(eligible);
  } catch (error) {
    if (options.throwOnError)
      throw new SiteError(503, "Paid site entitlement temporarily unavailable");
    throw error;
  }
}
