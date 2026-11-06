import { z } from "zod";
import { insertCatalogValuation } from "@/lib/supabase/catalog_valuations/insertCatalogValuation";

const amount = z.number().finite().nonnegative();
const inputSchema = z.object({
  catalogId: z.string().uuid(),
  valuation: z
    .object({ low: amount, mid: amount, high: amount })
    .refine(band => band.low <= band.mid && band.mid <= band.high),
  measuredSongCount: z.number().int().positive(),
  totalStreams: z.number().int().nonnegative(),
});

/** Save one completed-run estimate. False means no confirmed save; never retry paid work here. */
export async function persistCatalogValuation(
  input: z.infer<typeof inputSchema>,
): Promise<boolean> {
  const validated = inputSchema.safeParse(input);
  if (!validated.success) return false;
  const { catalogId, valuation, measuredSongCount, totalStreams } = validated.data;
  try {
    const row = await insertCatalogValuation({
      catalog_id: catalogId,
      ...valuation,
      measured_song_count: measuredSongCount,
      total_streams: totalStreams,
    });
    return Boolean(row?.id);
  } catch (error) {
    console.error("Error persisting catalog valuation:", error);
    return false;
  }
}
