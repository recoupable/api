import { wrapFetchWithPayment } from "x402-fetch";
import { toAccount } from "viem/accounts";
import { getAccount } from "@/lib/coinbase/getAccount";
import { deductCredits } from "../credits/deductCredits";
import { loadAccount } from "./loadAccount";

/**
 * Fetches a URL with x402 payment handling.
 *
 * @param url - The URL to fetch.
 * @param accountId - The account ID.
 * @returns Promise resolving to the Response.
 */
export async function fetchWithPayment(url: string, accountId: string): Promise<Response> {
  const account = await getAccount(accountId);
  await deductCredits({ accountId, creditsToDeduct: 1 });
  await loadAccount(account.address);
  const fetchWithPaymentWrapper = wrapFetchWithPayment(fetch, toAccount(account));
  return fetchWithPaymentWrapper(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}
