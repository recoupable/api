import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { startInstagramProfileScraping } from "@/lib/apify/instagram/startInstagramProfileScraping";
import { validateGetInstagramProfilesRequest } from "@/lib/apify/instagram/validateGetInstagramProfilesRequest";

export async function getInstagramProfilesHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const validated = await validateGetInstagramProfilesRequest(request);
    if (validated instanceof NextResponse) return validated;

    const run = await startInstagramProfileScraping(validated);

    if (!run) {
      return NextResponse.json(
        { status: "error", error: "Failed to start Instagram profile scraping" },
        { status: 500, headers },
      );
    }

    return NextResponse.json({ runId: run.runId, datasetId: run.datasetId }, { headers });
  } catch (error) {
    console.error("[ERROR] getInstagramProfilesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
