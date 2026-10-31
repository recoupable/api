import type { NextRequest } from "next/server";
import { verifySlackRequestSignature } from "@/lib/slack/verifySlackRequestSignature";

/**
 * Verifies Slack setup challenges before bot initialization. Ordinary events
 * remain with the adapter; cloning preserves their original request body.
 *
 * @param request - The incoming webhook request
 * @param signingSecret - The signing secret for this specific Slack app
 * @returns Challenge, unauthorized response, or null to continue to the adapter
 */
export async function handleUrlVerification(
  request: NextRequest,
  signingSecret: string | undefined,
): Promise<Response | null> {
  const rawBody = await request.clone().text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("type" in body) ||
    body.type !== "url_verification" ||
    !("challenge" in body) ||
    typeof body.challenge !== "string"
  )
    return null;

  if (!verifySlackRequestSignature(request, rawBody, signingSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ challenge: body.challenge });
}
