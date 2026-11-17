import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
/** Fresh read using the existing paid-site rule; no per-instance fan-request cache. */
export async function readPaidSiteSubscription(ownerId: string) {
  const eligible = (subscription: Awaited<ReturnType<typeof getActiveSubscriptions>>[number]) =>
    subscription.status === "active" &&
    subscription.items.data.some(item => (item.price.unit_amount ?? 0) > 0);
  return (await getActiveSubscriptions(ownerId, eligible)).some(eligible);
}
