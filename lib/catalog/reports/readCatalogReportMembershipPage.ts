import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { errorResponse } from "@/lib/networking/errorResponse";
import { resolveCatalogReportScope } from "./resolveCatalogReportScope";
import { catalogReportIntentSchema } from "./catalogReportIntent";

const pageSchema = z
  .object({
    page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine(({ page, limit }) => Number.isSafeInteger(page * limit));

/** One ordered catalog_songs page; no stable membership generation or execution authority. */
export async function readCatalogReportMembershipPage(
  request: NextRequest,
  input: unknown,
  pagination: unknown,
) {
  const intent = catalogReportIntentSchema.safeParse(input);
  const parsedPage = pageSchema.safeParse(pagination);
  if (!intent.success || !parsedPage.success)
    return errorResponse("Invalid catalog membership read", 400);
  const before = await resolveCatalogReportScope(request, intent.data);
  if (before instanceof NextResponse) return before;
  const { page, limit } = parsedPage.data;
  try {
    // The existing selector orders catalog_songs.song descending and preserves creator-less rows.
    const result = await selectCatalogSongsWithArtists({
      catalogId: before.catalogId,
      page,
      limit,
      observeCount: true,
    });
    if (
      !Array.isArray(result.songs) ||
      result.songs.length > limit ||
      result.songs.some(
        song =>
          !song ||
          song.catalog_id !== before.catalogId ||
          typeof song.isrc !== "string" ||
          !song.isrc.trim(),
      ) ||
      new Set(result.songs.map(song => song.isrc)).size !== result.songs.length
    ) {
      return errorResponse("Invalid catalog membership observation", 500);
    }
    // Revocation during the query must not return the rows. Two checks are not a transaction or grant.
    const after = await resolveCatalogReportScope(request, intent.data);
    if (after instanceof NextResponse) return after;
    if (
      JSON.stringify(before.principal) !== JSON.stringify(after.principal) ||
      before.effectiveAccountId !== after.effectiveAccountId ||
      before.ownerAccountId !== after.ownerAccountId
    ) {
      return errorResponse("Principal changed during catalog membership observation", 409);
    }
    const count = result.observed_total_count;
    const offset = (page - 1) * limit;
    const observedTotalCount =
      typeof count === "number" &&
      Number.isSafeInteger(count) &&
      count >= 0 &&
      (result.songs.length === 0 || count >= offset + result.songs.length)
        ? count
        : null;
    return {
      scope: after,
      members: result.songs.map(song => ({ isrc: song.isrc })),
      pagination: {
        page,
        limit,
        returned: result.songs.length,
        observedTotalCount,
        hasMore:
          observedTotalCount === null ? null : offset + result.songs.length < observedTotalCount,
      },
      coverage: {
        complete: false as const,
        generation: null,
        reason: "stable_membership_generation_unavailable" as const,
      },
      provenance: {
        relation: "catalog_songs" as const,
        selector: "selectCatalogSongsWithArtists" as const,
        ordering: "song descending" as const,
        startedAt: before.observedAt,
        finishedAt: after.observedAt,
      },
    };
  } catch {
    return errorResponse("Could not observe catalog membership", 500);
  }
}
