import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { startInstagramCommentsScraping } from "@/lib/apify/instagram/startInstagramCommentsScraping";
import { validateGetInstagramCommentsRequest } from "@/lib/apify/instagram/validateGetInstagramCommentsRequest";

export async function getInstagramCommentsHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const validated = await validateGetInstagramCommentsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const run = await startInstagramCommentsScraping(validated);

    if (!run) {
      return NextResponse.json(
        { status: "error", error: "Failed to start Instagram comments scraping" },
        { status: 500, headers },
      );
    }

    // Wire-parity with legacy ApifyScraperResult: camelCase runId/datasetId at root.
    return NextResponse.json({ runId: run.runId, datasetId: run.datasetId }, { headers });
  } catch (error) {
    console.error("[ERROR] getInstagramCommentsHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
