import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetFilesQuery } from "@/lib/files/validateGetFilesQuery";
import { listFilesByArtist, type ListedFileRecord } from "@/lib/files/listFilesByArtist";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

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

    const ownerIds = Array.from(new Set(files.map(file => file.owner_account_id).filter(Boolean)));
    const ownerEmailRows = ownerIds.length
      ? await selectAccountEmails({ accountIds: ownerIds })
      : [];

    const ownerEmails = new Map<string, string | null>();
    for (const row of ownerEmailRows) {
      if (!row.account_id || ownerEmails.has(row.account_id)) continue;
      ownerEmails.set(row.account_id, row.email ?? null);
    }

    const enrichedFiles: ListedFileRecord[] = files.map(file => ({
      ...file,
      owner_email: ownerEmails.get(file.owner_account_id) ?? null,
    }));

    return NextResponse.json(
      { files: enrichedFiles },
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
