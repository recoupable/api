import type { Address } from "viem";
import { cdp } from "./client";
import type { EvmServerAccount } from "@coinbase/cdp-sdk";

/**
 * Gets an EVM account by address.
 *
 * @param address - The address of the account to retrieve.
 * @returns Promise resolving to the EVM server account.
 */
export async function getAccount(address: Address): Promise<EvmServerAccount> {
  try {
    const account = await cdp.evm.getAccount({ address });
    return account;
  } catch (error) {
    console.error("[getAccount] Error:", error);
    throw new Error(`Failed to get account for address ${address}`);
  }
}
