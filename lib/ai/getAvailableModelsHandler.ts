import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAvailableModels } from "@/lib/ai/getAvailableModels";

/**
 * Handles GET /api/ai/models — proxies the Vercel AI Gateway model catalog
 * (filtered to exclude embed models). Mirrors chat's response shape exactly.
 *
 * @returns A NextResponse with `{ models }` on 200 or `{ message }` on 500.
 */
export async function getAvailableModelsHandler(): Promise<NextResponse> {
  try {
    const models = await getAvailableModels();
    return NextResponse.json(
      { models },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("/api/ai/models error", error);
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json(
      { message },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
