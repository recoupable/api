import type { NextRequest } from "next/server";
import { after } from "next/server";

/** Platforms served by the coding-agent bot. */
const ALLOWED_PLATFORMS = new Set(["slack", "github", "whatsapp"]);

/**
 * Verifies a Slack request signature using HMAC-SHA256.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * @param request - The incoming Slack request
 * @param rawBody - The raw request body string
 * @returns True if the signature is valid, false otherwise
 */
async function verifySlackSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signature || !timestamp || !signingSecret) {
    return false;
  }

  // Reject requests older than 5 minutes to prevent replay attacks.
  // Use Number() + isInteger() to reject partial/NaN timestamps that parseInt would silently accept.
  const requestTimestamp = Number(timestamp);
  if (!Number.isInteger(requestTimestamp)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTimestamp) > 300) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(baseString),
  );
  const computedSignature = `v0=${Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")}`;

  // Timing-safe comparison
  if (computedSignature.length !== signature.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < computedSignature.length; i++) {
    mismatch |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * GET /api/coding-agent/[platform]
 *
 * Handles webhook verification handshakes (e.g. WhatsApp hub.challenge).
 *
 * @param request - The incoming verification request
 * @param params - Route params containing the platform name
 * @param params.params - Promise resolving to route params
 * @returns A Response from the platform webhook handler, or 404 for unknown platforms
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  if (!ALLOWED_PLATFORMS.has(platform)) {
    return new Response("Unknown platform", { status: 404 });
  }

  // Lazy-load the bot and handler registration to avoid env/Redis startup for invalid platforms.
  const { codingAgentBot } = await import("@/lib/coding-agent/bot");
  await import("@/lib/coding-agent/handlers/registerHandlers");

  const handler = codingAgentBot.webhooks[platform as keyof typeof codingAgentBot.webhooks];

  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }

  return handler(request, { waitUntil: p => after(() => p) });
}

/**
 * POST /api/coding-agent/[platform]
 *
 * Webhook endpoint for the coding agent bot.
 * Handles Slack and WhatsApp webhooks via dynamic [platform] segment.
 *
 * @param request - The incoming webhook request
 * @param params - Route params containing the platform name
 * @param params.params - Promise resolving to route params
 * @returns A Response from the platform webhook handler, 401 for invalid signatures, or 404 for unknown platforms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  // Validate platform before loading the bot to avoid unnecessary env/Redis startup.
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return new Response("Unknown platform", { status: 404 });
  }

  // Handle Slack signature verification and url_verification challenge before loading the bot.
  // This avoids blocking on Redis/adapter initialization during setup.
  if (platform === "slack") {
    const rawBody = await request.clone().text();
    const isValid = await verifySlackSignature(request, rawBody);

    if (!isValid) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: unknown = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // not JSON — fall through to normal handler
    }

    const parsedBody = body as Record<string, unknown> | null;
    if (parsedBody?.type === "url_verification" && typeof parsedBody?.challenge === "string") {
      return Response.json({ challenge: parsedBody.challenge });
    }
  }

  // Lazy-load the bot and handler registration after all short-circuit checks.
  const { codingAgentBot } = await import("@/lib/coding-agent/bot");
  await import("@/lib/coding-agent/handlers/registerHandlers");

  const handler = codingAgentBot.webhooks[platform as keyof typeof codingAgentBot.webhooks];

  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }

  await codingAgentBot.initialize();

  return handler(request, { waitUntil: p => after(() => p) });
}
