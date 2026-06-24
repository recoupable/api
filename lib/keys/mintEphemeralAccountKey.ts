import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";

/** Default lifetime for an ephemeral key: 15 minutes. */
export const DEFAULT_EPHEMERAL_KEY_TTL_MS = 15 * 60 * 1000;

export type EphemeralAccountKey = { rawKey: string; keyId: string };

/**
 * Mint a short-lived, account-scoped `recoup_sk_` api key for a headless run
 * (recoupable/chat#1813). Returns the raw key — to inject as `$RECOUP_API_KEY`
 * into the sandbox — and the row id, so the caller can delete it on run end.
 * The key also auto-expires via `account_api_keys.expires_at` (defense in depth
 * if the delete is missed). The long-lived service key never enters the sandbox.
 */
export async function mintEphemeralAccountKey(
  accountId: string,
  {
    ttlMs = DEFAULT_EPHEMERAL_KEY_TTL_MS,
    name = "ephemeral:chat-generate",
  }: {
    ttlMs?: number;
    name?: string;
  } = {},
): Promise<EphemeralAccountKey> {
  const rawKey = generateApiKey("recoup_sk");
  const keyHash = hashApiKey(rawKey, PRIVY_PROJECT_SECRET);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const { data, error } = await insertApiKey({
    name,
    account: accountId,
    key_hash: keyHash,
    expires_at: expiresAt,
  });

  if (error || !data) {
    throw new Error(`Failed to mint ephemeral api key: ${error?.message ?? "no row returned"}`);
  }

  return { rawKey, keyId: data.id };
}
