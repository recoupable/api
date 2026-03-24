import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { streamText } from "ai";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateLaunchBody } from "./validateLaunchBody";
import { buildCampaignSystemPrompt, buildCampaignUserPrompt } from "./buildCampaignPrompt";
import { DEFAULT_MODEL } from "@/lib/const";

/**
 * Handles POST /api/launch — streams an AI-generated release campaign.
 *
 * @param request - The incoming request
 * @returns A streaming text response containing the campaign sections
 */
export async function generateCampaignHandler(request: NextRequest): Promise<Response> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const json = await request.json();
  const validated = validateLaunchBody(json);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const result = streamText({
    model: DEFAULT_MODEL,
    system: buildCampaignSystemPrompt(),
    prompt: buildCampaignUserPrompt(validated),
  });

  return result.toTextStreamResponse({ headers: getCorsHeaders() });
}
