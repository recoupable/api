import type { NextRequest } from "next/server";

/**
 * Handles Slack url_verification challenge before bot initialization.
 * This avoids blocking on Redis/adapter initialization during setup.
 *
 * @param request - The incoming webhook request
 * @returns A Response with the challenge if verified, or null to continue processing
 */
export async function handleUrlVerification(request: NextRequest): Promise<Response | null> {
  const body = await request
    .clone()
    .json()
    .catch(() => null);

  if (body?.type === "url_verification" && typeof body?.challenge === "string") {
    return Response.json({ challenge: body.challenge });
  }

  return null;
}
