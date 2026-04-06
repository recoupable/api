import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetConnectorsRequest } from "./validateGetConnectorsRequest";
import { getConnectors } from "./getConnectors";
import { enrichConnectorsWithSocials } from "./enrichConnectorsWithSocials";

/**
 * Display names for connectors.
 */
const CONNECTOR_DISPLAY_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  googlesheets: "Google Sheets",
  googledrive: "Google Drive",
  googledocs: "Google Docs",
};

/**
 * Handler for GET /api/connectors.
 *
 * Lists all available connectors and their connection status.
 * Use account_id query param to get connectors for a specific entity.
 * When an account_id is provided, connectors are enriched with social
 * profile data (avatar, username) from the artist's linked socials.
 *
 * @param request - The incoming request
 * @returns List of connectors with connection status
 */
export async function getConnectorsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    // Validate auth, query params, and access in one call
    const validated = await validateGetConnectorsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { accountId } = validated;

    // Fetch all connectors — no filtering at the API level
    const connectors = await getConnectors(accountId, {
      displayNames: CONNECTOR_DISPLAY_NAMES,
    });

    // Enrich with social profile data (avatar, username)
    const enriched = await enrichConnectorsWithSocials(connectors, accountId);

    return NextResponse.json(
      {
        success: true,
        connectors: enriched,
      },
      { status: 200, headers },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch connectors";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
