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
  if (!options.throwOnError)
    return (await getActiveSubscriptions(ownerId, eligible)).some(eligible);
  try {
    return (await getActiveSubscriptions(ownerId, eligible, { throwOnError: true })).some(eligible);
  } catch (error) {
    console.error("Error checking paid site entitlement:", error);
    throw new SiteError(503, "Paid site entitlement temporarily unavailable");
  }
}
