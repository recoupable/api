import { cdp } from "./client";
import { ACCOUNT_ADDRESS, SMART_ACCOUNT_ADDRESS } from "@/lib/const";
import type { EvmSmartAccount } from "@coinbase/cdp-sdk";

/**
 * Gets a smart account by retrieving the owner account and then getting the smart account.
 *
 * @returns Promise resolving to the EVM smart account.
 */
export async function getSmartAccount(): Promise<EvmSmartAccount> {
  try {
    const account = await cdp.evm.getAccount({ address: ACCOUNT_ADDRESS });
    const smartAccount = await cdp.evm.getSmartAccount({
      address: SMART_ACCOUNT_ADDRESS,
      owner: account,
    });
    return smartAccount;
  } catch (error) {
    console.error("[getSmartAccount] Error:", error);
    throw new Error(
      `Failed to get smart account: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
