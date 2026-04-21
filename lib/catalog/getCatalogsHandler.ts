import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetCatalogsRequest } from "@/lib/catalog/validateGetCatalogsRequest";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

/**
 * Handler for GET /api/accounts/{id}/catalogs.
 *
 * Lists catalogs linked to the account via `account_catalogs`, ordered by
 * `created_at desc`. Response body is byte-identical to the legacy
 * `GET /api/catalogs?account_id=...` endpoint on `api.recoupable.com`.
 *
 * @param request - The incoming request
 * @param params - Route params containing the account ID
 * @returns 200 with `{ status, catalogs }`, or 400/401/403/404/500 on error
 */
export async function getCatalogsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateGetCatalogsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const catalogs = await selectAccountCatalogs(validated.accountId);

    return NextResponse.json(
      { status: "success", catalogs },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getCatalogsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
