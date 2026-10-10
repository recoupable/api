import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getCatalogStreams } from "./getCatalogStreams";
import { manageCatalogStreamTracking } from "./manageCatalogStreamTracking";
import { validateCatalogStreamHistoryQuery } from "./validateCatalogStreamHistoryQuery";
import { validateCatalogStreamTracking } from "./validateCatalogStreamTracking";

/** Authenticated stream history and tracking control; caller identity always comes from auth. */
export async function catalogStreamsHandler(
  request: NextRequest,
  catalogId: string,
  mode: "history" | "tracking",
): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) return auth;
    const params = new URL(request.url).searchParams;
    if (new Set([...params.keys()]).size !== [...params.keys()].length || params.has("catalog_id"))
      return errorResponse("Invalid or duplicate query", 400);
    let result;
    if (mode === "history") {
      const parsed = validateCatalogStreamHistoryQuery({
        ...Object.fromEntries(params),
        catalog_id: catalogId,
      });
      if (!parsed.success) return errorResponse("Invalid stream query", 400);
      result = await getCatalogStreams(auth.accountId, parsed.data);
    } else {
      if (params.size) return errorResponse("Tracking query parameters are unsupported", 400);
      let action: "enable" | "disable" | "refresh" | "status" = "status";
      if (request.method === "POST") {
        const body = z
          .object({ action: z.enum(["enable", "disable", "refresh"]) })
          .strict()
          .safeParse(await request.json().catch(() => null));
        if (!body.success) return errorResponse("Invalid tracking action", 400);
        action = body.data.action;
      }
      const parsed = validateCatalogStreamTracking({ catalog_id: catalogId, action });
      if (!parsed.success) return errorResponse("Invalid catalog ID", 400);
      result = await manageCatalogStreamTracking(auth.accountId, parsed.data);
    }
    const response =
      "error" in result ? errorResponse(result.error, result.status) : successResponse(result.data);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    console.error("[catalogStreamsHandler] operation failed");
    return errorResponse("Catalog streams unavailable", 503);
  }
}
