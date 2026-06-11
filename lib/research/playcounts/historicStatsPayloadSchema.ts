import { z } from "zod";

/**
 * Envelope schema for Songstats `tracks/historic_stats` payloads — validates
 * exactly the parts this codebase operates on (per-point provenance labels on
 * `stats[].data.history[]`) while passing every other field through untouched
 * (`looseObject`): Songstats owns the rest of the shape.
 */
export const historicStatsPayloadSchema = z.looseObject({
  stats: z
    .array(
      z.looseObject({
        source: z.string().optional(),
        data: z
          .looseObject({
            history: z.array(z.looseObject({ date: z.string().optional() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type HistoricStatsPayload = z.infer<typeof historicStatsPayloadSchema>;
