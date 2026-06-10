import { z } from "zod";

/**
 * Envelope schema for Songstats `tracks/stats` payloads — validates exactly
 * the parts this codebase operates on (`stats[]` entries get provenance
 * labels and store-served entries appended) while passing every other field
 * through untouched (`looseObject`): Songstats owns the rest of the shape
 * and adds fields without notice.
 */
export const trackStatsPayloadSchema = z.looseObject({
  stats: z
    .array(
      z.looseObject({
        source: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export type TrackStatsPayload = z.infer<typeof trackStatsPayloadSchema>;
