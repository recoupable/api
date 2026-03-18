import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";
import { deductCredits } from "@/lib/credits/deductCredits";
import { getCreditsForPrice } from "@/lib/mpp/getCreditsForPrice";
import { IMAGE_GENERATE_PRICE } from "@/lib/const";

/**
 * Fetches a URL with MPP payment handling using the Tempo payment method.
 * Deducts credits from the account before making the payment.
 *
 * @param url - The URL to fetch.
 * @param accountId - The account ID to deduct credits from.
 * @returns Promise resolving to the Response.
 */
export async function fetchWithMppPayment(url: string, accountId: string): Promise<Response> {
  const paymentKey = process.env.MPP_PAYMENT_KEY as `0x${string}`;
  if (!paymentKey) {
    throw new Error("MPP_PAYMENT_KEY environment variable is required");
  }

  const creditsToDeduct = getCreditsForPrice(IMAGE_GENERATE_PRICE);
  await deductCredits({ accountId, creditsToDeduct });

  const account = privateKeyToAccount(paymentKey);
  const mppx = Mppx.create({
    methods: [tempo({ account })],
    polyfill: false,
  });

  return mppx.fetch(url, { method: "GET" });
}
