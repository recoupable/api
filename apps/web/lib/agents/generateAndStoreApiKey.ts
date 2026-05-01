import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";

/**
 * Generates a new API key for an account, stores its hash in the database,
 * and returns the raw key. Throws if the database insert fails — this is the
 * load-bearing guarantee that prevents the caller from leaking an
 * un-persisted API key back to the user.
 *
 * @param accountId - Account to associate the key with
 * @returns The raw (un-hashed) API key string
 */
export async function generateAndStoreApiKey(accountId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const rawKey = generateApiKey("recoup_sk");
  const keyHash = hashApiKey(rawKey, PRIVY_PROJECT_SECRET);
  const { error } = await insertApiKey({
    name: `Agent ${today}`,
    account: accountId,
    key_hash: keyHash,
  });
  if (error) {
    throw new Error(`insertApiKey failed: ${error.message ?? "unknown error"}`);
  }
  return rawKey;
}
