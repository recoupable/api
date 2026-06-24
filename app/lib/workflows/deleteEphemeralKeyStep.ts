import { deleteApiKey } from "@/lib/supabase/account_api_keys/deleteApiKey";

/**
 * Vercel Workflow `"use step"` that deletes the ephemeral, account-scoped
 * `recoup_sk_…` key minted for a headless `/api/chat/generate` run
 * (recoupable/chat#1813). Called from `runAgentWorkflow`'s `finally` so the
 * credential is revoked the moment the run ends — the key's ~15m `expires_at`
 * TTL (enforced in `getApiKeyAccountId`) is only the backstop if this is missed.
 *
 * Defensively swallows its own errors: a cleanup hiccup must not fail the run,
 * and the TTL still guarantees the key can't outlive its window.
 *
 * @param keyId - `account_api_keys.id` of the ephemeral key to delete.
 */
export async function deleteEphemeralKeyStep(keyId: string): Promise<void> {
  "use step";
  try {
    const { error } = await deleteApiKey(keyId);
    if (error) {
      console.error(`[deleteEphemeralKeyStep] failed to delete key ${keyId}:`, error);
    }
  } catch (error) {
    console.error(`[deleteEphemeralKeyStep] unhandled error deleting key ${keyId}:`, error);
  }
}
