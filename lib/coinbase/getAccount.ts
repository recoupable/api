import { cdp } from "./client";
import type { EvmServerAccount } from "@coinbase/cdp-sdk";

/**
 * Gets an EVM account by account ID, creating it if it doesn't exist.
 *
 * @param accountId - The account ID (name) of the account to retrieve.
 * @returns Promise resolving to the EVM server account.
 */
export async function getAccount(accountId: string): Promise<EvmServerAccount> {
  try {
    const account = await cdp.evm.getAccount({ name: accountId });
    return account;
  } catch {
    try {
      const newAccount = await cdp.evm.createAccount({ name: accountId });
      return newAccount;
    } catch (createError) {
      console.error("[getAccount] Error creating account:", createError);
      throw new Error(`Failed to get or create account for accountId ${accountId}`);
    }
  }
}
