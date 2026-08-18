import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";

/**
 * Default lifetime for an ephemeral key: 24 hours. The TTL is only the
 * backstop — `runAgentWorkflow` revokes the key the moment the run ends
 * (`deleteEphemeralKeyStep`), so a longer TTL does not extend key life on
 * normal completion; it only widens exposure when a crashed workflow misses
 * the delete. This ceiling has been raised twice by real incidents: 15
 * minutes 401'd a customer run's final sends on 2026-07-03 (chat#1839), and
 * 60 minutes killed a slow-model run mid-flight on 2026-08-12 — every
 * remaining API call including the email send 401'd while the workflow
 * flailed on (chat#1957). 24 hours is a deliberately generous ceiling to end
 * the "TTL vs slowest legitimate run" race rather than schedule its third
 * round.
 */
export const DEFAULT_EPHEMERAL_KEY_TTL_MS = 24 * 60 * 60 * 1000;

export type EphemeralAccountKey = { rawKey: string; keyId: string };

/**
 * Mint a short-lived, account-scoped `recoup_sk_` api key for a headless run
 * (recoupable/chat#1813). Returns the raw key — to inject as `$RECOUP_API_KEY`
 * into the sandbox — and the row id, so the caller can delete it on run end.
 * The key also auto-expires via `account_api_keys.expires_at` (defense in depth
 * if the delete is missed; enforced in `getApiKeyAccountId`). The long-lived
 * service key never enters the sandbox.
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
