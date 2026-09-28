import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import { SiteError } from "../SiteError";
/** Explicit launch policy; no invented price or silently enabled free tier. */
export async function requireFanEntitlement(ownerId: string) {
  const policy = process.env.SITES_FAN_CONNECTION_BILLING;
  const allowedPrices = (process.env.SITES_FAN_CONNECTION_PRICE_IDS || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
  if (policy !== "paid-subscription" && !(policy === "price-allowlist" && allowedPrices.length))
    throw new SiteError(503, "Paid fan connection activation is not configured");
  const subscriptions = await getActiveSubscriptions(ownerId);
  const eligible = subscriptions.some(
    subscription =>
      subscription.status === "active" &&
      subscription.items.data.some(item =>
        policy === "price-allowlist"
          ? allowedPrices.includes(item.price.id)
          : (item.price.unit_amount ?? 0) > 0,
      ),
  );
  if (!eligible)
    throw new SiteError(
      402,
      "An eligible paid Recoup subscription is required for this site's workspace",
    );
}
