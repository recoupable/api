import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleUrlVerification } from "@/lib/slack/handleUrlVerification";
import { verifySlackRequestSignature } from "@/lib/slack/verifySlackRequestSignature";

const whatsAppVerificationSchema = z.object({
  mode: z.literal("subscribe"),
  token: z.string(),
  challenge: z.string().nullable(),
});

/**
 * Checks the adapters' existing signature/verification contracts before loading
 * their bot or state. Clones preserve the raw body for SDK verification.
 *
 * @param request - Incoming platform request
 * @param platform - Supported adapter name
 * @param signingSecret - Matching adapter's signing secret
 * @param verifyToken - WhatsApp GET verification token
 * @returns Early response, or null to delegate authenticated events to the SDK
 */
export async function validatePlatformWebhookRequest(
  request: NextRequest,
  platform: string,
  signingSecret: string | undefined,
  verifyToken?: string,
): Promise<Response | null> {
  if (platform === "whatsapp" && request.method === "GET") {
    const query = request.nextUrl.searchParams;
    const parsed = whatsAppVerificationSchema.safeParse({
      mode: query.get("hub.mode"),
      token: query.get("hub.verify_token"),
      challenge: query.get("hub.challenge"),
    });
    if (verifyToken && parsed.success && parsed.data.token === verifyToken) {
      return new Response(parsed.data.challenge ?? "");
    }
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.clone().text();
  if (platform === "slack") {
    if (!verifySlackRequestSignature(request, body, signingSecret)) {
      return new Response("Invalid signature", { status: 401 });
    }
    return request.method === "POST" ? handleUrlVerification(request, signingSecret) : null;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signingSecret || !signature) return new Response("Invalid signature", { status: 401 });
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", signingSecret).update(body).digest("hex")}`,
  );
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return new Response("Invalid signature", { status: 401 });
  }
  return null;
}
