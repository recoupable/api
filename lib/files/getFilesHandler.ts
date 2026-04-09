import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetFilesQuery } from "@/lib/files/validateGetFilesQuery";
import { listFilesByArtist } from "@/lib/files/listFilesByArtist";

/**
 * Handles GET /api/files requests.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with files or an error.
 */
export async function getFilesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validatedQuery = await validateGetFilesQuery(request);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const files = await listFilesByArtist(
      validatedQuery.artist_account_id,
      validatedQuery.path,
      validatedQuery.recursive,
    );

    return NextResponse.json(
      { files },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
