import { timingSafeEqual } from "crypto";

/**
 * Verify Git Hub Webhook.
 *
 * @param body - Request payload.
 * @param signature - Value for signature.
 * @param secret - Value for secret.
 * @returns - Computed result.
 */
export async function verifyGitHubWebhook(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `sha256=${hex}`;

  if (signature.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
