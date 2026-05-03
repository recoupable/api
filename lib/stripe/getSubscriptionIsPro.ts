import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { isActiveSubscription } from "@/lib/stripe/isActiveSubscription";

export async function getSubscriptionIsPro(accountId: string): Promise<boolean> {
  const [accountSubscription, orgSubscription] = await Promise.all([
    getActiveSubscriptionDetails(accountId),
    getOrgSubscription(accountId),
  ]);

  return isActiveSubscription(accountSubscription) || isActiveSubscription(orgSubscription);
}
