import { timingSafeEqual } from "crypto";

/**
 * Verifies a GitHub webhook signature using HMAC SHA-256.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param body - Raw request body string
 * @param signature - The x-hub-signature-256 header value
 * @param secret - The webhook secret
 * @returns True if the signature is valid, false otherwise
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
