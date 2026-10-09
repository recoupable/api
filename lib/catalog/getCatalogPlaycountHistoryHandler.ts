import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateCatalogPlaycountHistoryQuery } from "./validateCatalogPlaycountHistoryQuery";
import { getCatalogPlaycountHistory } from "./getCatalogPlaycountHistory";

/**
 * GET /api/catalogs/{catalogId}/playcount-history. Read-only store-backed comparison;
 * both API keys and bearer tokens are supported. Identity overrides are rejected.
 * @param request - Incoming request.
 * @param catalogId - Authoritative path ID.
 */
export async function getCatalogPlaycountHistoryHandler(
  request: NextRequest,
  catalogId: string,
): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) return auth;
    const params = new URL(request.url).searchParams;
    const keys = [...params.keys()];
    if (new Set(keys).size !== keys.length || params.has("catalog_id")) {
      return errorResponse("Duplicate or overridden query parameter", 400);
    }
    const parsed = validateCatalogPlaycountHistoryQuery({
      ...Object.fromEntries(params),
      catalog_id: catalogId,
    });
    if (!parsed.success) return errorResponse("Invalid comparison query", 400);
    const result = await getCatalogPlaycountHistory(auth.accountId, parsed.data);
    const response =
      "error" in result ? errorResponse(result.error, result.status) : successResponse(result.data);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return errorResponse("Catalog playcount history unavailable", 503);
  }
}
