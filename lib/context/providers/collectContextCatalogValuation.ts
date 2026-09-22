import { z } from "zod";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";
type Dependencies = {
  authorize: (accountId: string, catalogId: string) => Promise<void>;
  aggregate: (
    catalogId: string,
  ) => Promise<{ measuredSongCount: number; totalStreams: number } | null>;
  songCount: (catalogId: string) => Promise<number>;
  earliestDate: (catalogId: string) => Promise<string | null>;
};
/** Account must come from validated auth. Reads existing measurements; does not refresh or purchase data. */
export async function collectContextCatalogValuation(
  accountId: string,
  catalogId: string,
  deps?: Dependencies,
) {
  z.uuid().parse(accountId);
  z.uuid().parse(catalogId);
  const dependencies = deps ?? {
    authorize: async (account: string, catalog: string) => {
      const { getCatalogOwnerIds } = await import("@/lib/catalog/getCatalogOwnerIds");
      const { selectAccountCatalog } = await import(
        "@/lib/supabase/account_catalogs/selectAccountCatalog"
      );
      const ownerIds = await getCatalogOwnerIds(account);
      if (!(await selectAccountCatalog({ accountIds: ownerIds, catalogId: catalog })))
        throw new Error("Catalog not accessible");
    },
    aggregate: async (catalog: string) => {
      const { selectCatalogMeasurementsAggregate } = await import(
        "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate"
      );
      return selectCatalogMeasurementsAggregate({ catalogId: catalog });
    },
    songCount: async (catalog: string) => {
      const { countCatalogSongs } = await import("@/lib/supabase/catalog_songs/countCatalogSongs");
      return (await countCatalogSongs([catalog], { strict: true }))[catalog];
    },
    earliestDate: async (catalog: string) => {
      const { getCatalogEarliestReleaseDate } = await import(
        "@/lib/catalog/getCatalogEarliestReleaseDate"
      );
      return getCatalogEarliestReleaseDate(catalog);
    },
  };
  await dependencies.authorize(accountId, catalogId);
  const startedAt = new Date().toISOString(),
    start = Date.now();
  const [aggregate, earliestReleaseDate, totalSongCount] = await Promise.all([
    dependencies.aggregate(catalogId),
    dependencies.earliestDate(catalogId),
    dependencies.songCount(catalogId),
  ]);
  if (!aggregate) throw new Error("Catalog measurements unavailable");
  z.object({
    measuredSongCount: z.number().int().nonnegative(),
    totalStreams: z.number().finite().nonnegative(),
  }).parse(aggregate);
  z.number().int().nonnegative().parse(totalSongCount);
  if (aggregate.measuredSongCount > totalSongCount)
    throw new Error("Measured count exceeds catalog size; recollect a consistent snapshot");
  const ageSource =
    earliestReleaseDate && Number.isFinite(Date.parse(earliestReleaseDate))
      ? "release_date"
      : "model_default";
  const modeled = aggregate.measuredSongCount
    ? computeValuationBand({ totalStreams: aggregate.totalStreams, earliestReleaseDate })
    : null;
  return {
    status: modeled ? "estimated" : "not_measured",
    scope: "workspace_private",
    catalogId,
    measuredSongCount: aggregate.measuredSongCount,
    measurementCoverage: {
      totalSongCount,
      measuredSongCount: aggregate.measuredSongCount,
      unmeasuredSongCount: totalSongCount - aggregate.measuredSongCount,
      extent: !aggregate.measuredSongCount
        ? "unavailable"
        : aggregate.measuredSongCount === totalSongCount
          ? "full"
          : "partial",
    },
    ageSource: modeled ? ageSource : null,
    valuation: modeled?.valuation ?? null,
    catalogAgeYears: modeled?.catalogAgeYears ?? null,
    ageFlooredToOneYear: modeled?.ageFlooredToOneYear ?? null,
    inputs: { totalStreams: aggregate.totalStreams, earliestReleaseDate },
    trace: {
      startedAt,
      elapsedMs: Date.now() - start,
      executor: "Recoup computeValuationBand",
      source: "Existing catalog song measurements",
      currency: "USD",
      modelBasis:
        "Lifetime-average stream revenue proxy and assumed master-catalog multiples; not actual royalties or an appraisal.",
      measurementFreshness: "Not supplied by aggregate; unknown",
    },
  };
}
