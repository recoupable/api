import { hasPaidSiteSubscription } from "./hasPaidSiteSubscription";
import { SiteError } from "../SiteError";
/** Fan connection is included in active paid subscriptions, with no separate add-on. */
export async function requireFanEntitlement(ownerId: string) {
  if (!(await hasPaidSiteSubscription(ownerId)))
    throw new SiteError(
      402,
      "An active paid Recoup subscription is required for this site's workspace",
    );
}
