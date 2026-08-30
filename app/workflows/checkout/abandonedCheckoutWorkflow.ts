import { sleep } from "workflow";
import { ABANDONED_CHECKOUT_EMAIL_DELAY_MS } from "@/lib/const";
import {
  sendAbandonedCheckoutEmail,
  type AbandonedCheckoutEmailArgs,
  type AbandonedCheckoutEmailResult,
} from "@/lib/emails/lifecycle/sendAbandonedCheckoutEmail";

/**
 * Vercel Workflow started by the `checkout.session.expired` webhook: waits
 * a day (durable timer, survives deploys), then runs the send step, which
 * re-checks that the email has not subscribed in the meantime.
 */
export async function abandonedCheckoutWorkflow(
  args: AbandonedCheckoutEmailArgs,
): Promise<AbandonedCheckoutEmailResult> {
  "use workflow";

  await sleep(ABANDONED_CHECKOUT_EMAIL_DELAY_MS);
  return sendAbandonedCheckoutEmail(args);
}
