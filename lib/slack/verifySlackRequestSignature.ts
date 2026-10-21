import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Verifies Slack's signature over the raw body within its five-minute replay window. */
export function verifySlackRequestSignature(
  request: NextRequest,
  rawBody: string,
  signingSecret: string | undefined,
): boolean {
  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");
  if (!signingSecret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;

  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300) {
    return false;
  }
  if (!/^v0=[a-f0-9]{64}$/.test(signature)) return false;

  const expected = createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(3), "hex"));
}
