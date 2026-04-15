import { type NextRequest, NextResponse } from "next/server";
import { handleResearchRequest } from "@/lib/research/handleResearchRequest";
import { validateDiscoverQuery } from "@/lib/research/validateDiscoverQuery";

/**
 * Discover handler — filters artists by country, genre, listener ranges, growth rate.
 *
 * @param request - query params: country, genre, sort, limit, sp_monthly_listeners_min/max
 * @returns JSON artist list or error
 */
export async function getResearchDiscoverHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validated = validateDiscoverQuery(searchParams);

  if (validated instanceof NextResponse) return validated;

  return handleResearchRequest(
    request,
    () => "/artist/list/filter",
    () => {
      const params: Record<string, string> = {};
      if (validated.country) params.code2 = validated.country;
      if (validated.genre) params.tagId = validated.genre;
      if (validated.sort) params.sortColumn = validated.sort;
      if (validated.limit) params.limit = String(validated.limit);
      if (
        validated.sp_monthly_listeners_min !== undefined &&
        validated.sp_monthly_listeners_max !== undefined
      ) {
        params["sp_ml[]"] =
          `${validated.sp_monthly_listeners_min},${validated.sp_monthly_listeners_max}`;
      } else if (validated.sp_monthly_listeners_min !== undefined) {
        params["sp_ml[]"] = String(validated.sp_monthly_listeners_min);
      } else if (validated.sp_monthly_listeners_max !== undefined) {
        params["sp_ml[]"] = String(validated.sp_monthly_listeners_max);
      }
      return params;
    },
    data => ({ artists: Array.isArray(data) ? data : [] }),
  );
}
