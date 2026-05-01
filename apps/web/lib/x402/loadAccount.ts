import { sendUserOpAndWait } from "@/lib/coinbase/sendUserOpAndWait";
import { getTransferCalls } from "@/lib/x402/getTransferCalls";
import type { Address } from "viem";
import { IMAGE_GENERATE_PRICE } from "@/lib/const";

/**
 * Loads an account, gets or creates a smart account, and sends USDC to the specified address.
 *
 * @param recipientAddress - The address to send USDC to.
 * @returns Promise resolving to the transaction hash.
 */
export async function loadAccount(recipientAddress: Address): Promise<string> {
  try {
    const calls = getTransferCalls(recipientAddress, IMAGE_GENERATE_PRICE);

    const transactionHash = await sendUserOpAndWait(calls);

    return transactionHash;
  } catch (error) {
    console.error("[loadAccount] Error:", error);
    throw new Error(
      `Failed to load account and send USDC: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
