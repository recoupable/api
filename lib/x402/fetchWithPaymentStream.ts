import { wrapFetchWithPayment } from "x402-fetch";
import { toAccount } from "viem/accounts";
import { getAccount } from "@/lib/coinbase/getAccount";
import { deductCredits } from "../credits/deductCredits";
import { loadAccount } from "./loadAccount";
import { getCreditsForPrice } from "./getCreditsForPrice";
import { CHAT_PRICE } from "@/lib/const";
import { parseUnits } from "viem";

/**
 * Fetches a URL with x402 payment handling for POST requests with streaming response.
 *
 * This function:
 * 1. Gets the account for the given accountId
 * 2. Deducts credits from the account
 * 3. Loads the account wallet and sends USDC for the payment
 * 4. Makes the x402-authenticated request
 * 5. Returns the streaming response
 *
 * @param url - The URL to fetch.
 * @param accountId - The account ID.
 * @param body - The request body to send.
 * @param price - The price for the request (defaults to CHAT_PRICE).
 * @returns Promise resolving to the Response (streaming).
 */
export async function fetchWithPaymentStream(
  url: string,
  accountId: string,
  body: unknown,
  price: string = CHAT_PRICE,
): Promise<Response> {
  const account = await getAccount(accountId);
  const creditsToDeduct = getCreditsForPrice(price);
  await deductCredits({ accountId, creditsToDeduct });
  await loadAccount(account.address, price);
  const fetchWithPaymentWrapper = wrapFetchWithPayment(
    fetch,
    toAccount(account),
    parseUnits(price, 6),
  );
  return fetchWithPaymentWrapper(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
