import { wrapFetchWithPayment } from "x402-fetch";
import { toAccount } from "viem/accounts";
import { getAccount } from "@/lib/coinbase/getAccount";

const ACCOUNT_ADDRESS = "0x7AfB9872Ea382B7Eb01c67B6884dD99A744eA64f" as const;

/**
 * Fetches a URL with x402 payment handling.
 *
 * @param url - The URL to fetch.
 * @returns Promise resolving to the Response.
 */
export async function fetchWithPayment(url: string): Promise<Response> {
  const account = await getAccount(ACCOUNT_ADDRESS);
  const fetchWithPaymentWrapper = wrapFetchWithPayment(fetch, toAccount(account));
  return fetchWithPaymentWrapper(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}
