import { hasPaidSiteSubscription } from "./hasPaidSiteSubscription";
import { SiteError } from "../SiteError";
/** Fan connection is included in active paid subscriptions, with no separate add-on. */
export async function requireFanEntitlement(ownerId: string) {
  if (!(await hasPaidSiteSubscription(ownerId)))
    throw new SiteError(
      402,
      "Fan connection is unavailable with this workspace's current entitlements.",
    );
}
