import { z } from "zod";

/** Saved Spotify observations only; this schema grants no format or rights authority. */
export const contextReleaseFormatSchema = z.strictObject({
  source: z.literal("spotify_album_observation"),
  state: z.enum(["observed", "uncollected"]),
  observed_type: z.string().nullable(),
  format_state: z.enum(["single", "album", "compilation", "unknown"]),
  reported_total_tracks: z.number().int().nonnegative().nullable(),
  release_date: z.string().nullable(),
  release_date_precision: z.string().nullable(),
  label: z.string().nullable(),
  upc: z.string().nullable(),
  upc_state: z.enum(["observed", "not_observed", "uncollected"]),
  track_coverage: z.enum(["full", "partial", "uncollected"]),
  disc_count: z.number().int().positive().nullable(),
  multi_disc: z.boolean().nullable(),
  reissue: z.literal("unknown"),
  physical_format: z.literal("unknown"),
});
