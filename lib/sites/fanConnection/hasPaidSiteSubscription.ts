import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
const cache = new Map<string, { until: number; result: Promise<boolean> }>();
/** Coalesce concurrent fan requests; keep billing freshness within 30 seconds per instance. */
export async function hasPaidSiteSubscription(ownerId: string) {
  const existing = cache.get(ownerId);
  if (existing && existing.until > Date.now()) return existing.result;
  if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
  const result = getActiveSubscriptions(
    ownerId,
    subscription =>
      subscription.status === "active" &&
      subscription.items.data.some(item => (item.price.unit_amount ?? 0) > 0),
  ).then(subscriptions =>
    subscriptions.some(
      subscription =>
        subscription.status === "active" &&
        subscription.items.data.some(item => (item.price.unit_amount ?? 0) > 0),
    ),
  );
  cache.set(ownerId, { until: Date.now() + 30000, result });
  return result;
}
