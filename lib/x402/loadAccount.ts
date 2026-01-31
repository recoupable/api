import { sendUserOpAndWait } from "@/lib/coinbase/sendUserOpAndWait";
import { getTransferCalls } from "@/lib/x402/getTransferCalls";
import type { Address } from "viem";

/**
 * Loads an account, gets or creates a smart account, and sends USDC to the specified address.
 *
 * @param recipientAddress - The address to send USDC to.
 * @param price - The price in USDC to send (e.g., "0.01" for $0.01).
 * @returns Promise resolving to the transaction hash.
 */
export async function loadAccount(recipientAddress: Address, price: string): Promise<string> {
  try {
    const calls = getTransferCalls(recipientAddress, price);

    const transactionHash = await sendUserOpAndWait(calls);

    return transactionHash;
  } catch (error) {
    console.error("[loadAccount] Error:", error);
    throw new Error(
      `Failed to load account and send USDC: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
