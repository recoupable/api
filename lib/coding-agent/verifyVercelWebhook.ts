import crypto from "crypto";

/**
 * Verifies a Vercel webhook signature using HMAC-SHA1.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param body - Raw request body string
 * @param signature - The x-vercel-signature header value
 * @param secret - The webhook secret
 * @returns True if signature is valid
 */
export function verifyVercelWebhook(body: string, signature: string, secret: string): boolean {
  if (!signature) return false;

  const expected = crypto.createHmac("sha1", secret).update(body).digest("hex");

  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
