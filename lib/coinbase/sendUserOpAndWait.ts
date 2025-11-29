import { cdp } from "./client";
import { getSmartAccount } from "./getSmartAccount";
import { PAYMASTER_URL } from "@/lib/const";
import type { Address, Hex } from "viem";

export interface Call {
  to: Address;
  data: Hex;
}

/**
 * Sends a user operation, waits for it to be mined, and returns the transaction hash.
 *
 * @param calls - Array of calls to execute.
 * @returns Promise resolving to the transaction hash.
 */
export async function sendUserOpAndWait(calls: readonly Call[]): Promise<string> {
  try {
    const smartAccount = await getSmartAccount();

    // @ts-expect-error excessively deep type instantiation
    const sendResult = await cdp.evm.sendUserOperation({
      smartAccount,
      network: "base",
      paymasterUrl: PAYMASTER_URL,
      calls,
    });

    await cdp.evm.waitForUserOperation({
      smartAccountAddress: smartAccount.address,
      userOpHash: sendResult.userOpHash,
    });

    const userOp = await cdp.evm.getUserOperation({
      smartAccount,
      userOpHash: sendResult.userOpHash,
    });

    return userOp.transactionHash;
  } catch (error) {
    console.error("[sendUserOpAndWait] Error:", error);
    throw new Error(
      `Failed to send user operation and wait: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
