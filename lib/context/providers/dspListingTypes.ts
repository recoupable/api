import { z } from "zod";
import { APPLE_STOREFRONTS } from "@/lib/apple/storefronts";

/** Apple's lowercase two-letter storefront ids; an unknown code stops before any provider call. */
export const appleStorefrontSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2}$/, "Storefront must be a two-letter Apple Music storefront code")
  .refine(value => APPLE_STOREFRONTS.has(value), "Unknown Apple Music storefront");
/** At most ten storefronts per observation, deduplicated and sorted so order never changes reuse. */
export const appleStorefrontsSchema = z
  .array(appleStorefrontSchema)
  .min(1)
  .max(10)
  .transform(values => [...new Set(values)].sort());
const isrcSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/);
const providerIdSchema = z.string().min(1).max(256);

export const dspListingProviderSchema = z.enum(["apple_music", "youtube_music"]);
/** Store objects stay separate: a song never stands in for its album, a video, an art track or a channel. */
export const dspListingResourceTypeSchema = z.enum([
  "song",
  "album",
  "music_video",
  "art_track",
  "uploader_channel",
]);
/** Availability is observed for one storefront at one time; it is never a global status. */
export const dspAvailabilitySchema = z.strictObject({
  status: z.enum(["listed", "not_listed", "unknown"]),
  storefront: appleStorefrontSchema,
});
export const dspMatchFlagSchema = z.enum([
  "multiple_store_songs",
  "multiple_album_contexts",
  "remix_or_alternate_title",
  "regional_variant",
]);
export const dspMatchStatusSchema = z.enum([
  "exact_isrc",
  "ambiguous",
  "not_found",
  "unsupported_resource",
]);
/** Unknown comparisons stay null; they are not false. Version tokens are store-title words the recording title lacks. */
export const dspMatchEvidenceSchema = z.strictObject({
  isrcEcho: z.boolean(),
  titleMatch: z.boolean().nullable(),
  artistMatch: z.boolean().nullable(),
  durationDeltaMs: z.number().int().nullable(),
  versionTokens: z.array(z.string().min(1)).max(20),
});
export const dspMatchSchema = z.strictObject({
  status: dspMatchStatusSchema,
  evidence: dspMatchEvidenceSchema,
  flags: z.array(dspMatchFlagSchema),
});
export const dspListingSchema = z.strictObject({
  provider: dspListingProviderSchema,
  resourceType: dspListingResourceTypeSchema,
  providerId: providerIdSchema,
  storefront: appleStorefrontSchema,
  url: z.url().nullable(),
  observedAt: z.iso.datetime(),
  availability: dspAvailabilitySchema,
  match: dspMatchSchema,
});
/** The album is its own store object; its id is never a song, recording or release identifier. */
export const dspAlbumListingSchema = z.strictObject({
  provider: dspListingProviderSchema,
  resourceType: z.literal("album"),
  providerId: providerIdSchema,
  storefront: appleStorefrontSchema,
  name: z.string().nullable(),
  upc: z.string().nullable(),
  isSingle: z.boolean(),
  isCompilation: z.boolean(),
  url: z.url().nullable(),
});
export const dspSongListingSchema = dspListingSchema.extend({
  resourceType: z.literal("song"),
  isrc: z.string().nullable(),
  name: z.string().nullable(),
  artistName: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  albumListing: dspAlbumListingSchema.nullable(),
});
/** One storefront's observation for one recording ISRC. A listing never confirms identity. */
export const storefrontListingSchema = z.strictObject({
  provider: dspListingProviderSchema,
  isrc: isrcSchema,
  storefront: appleStorefrontSchema,
  observedAt: z.iso.datetime(),
  availability: dspAvailabilitySchema,
  match: z.strictObject({ status: dspMatchStatusSchema, flags: z.array(dspMatchFlagSchema) }),
  songListings: z.array(dspSongListingSchema).max(100),
});
/**
 * Every storefront observed for one recording ISRC in one saved result. `varies` is null
 * when fewer than two storefronts resolved songs, so no regional comparison was possible.
 */
export const recordingListingSchema = z.strictObject({
  provider: dspListingProviderSchema,
  isrc: isrcSchema,
  collectionVersion: z.string().min(1).max(100),
  storefronts: z.array(storefrontListingSchema).min(1).max(10),
  regionalComparison: z.strictObject({
    listedStorefronts: z.array(appleStorefrontSchema),
    songProviderIds: z.array(providerIdSchema),
    albumProviderIds: z.array(providerIdSchema),
    varies: z.boolean().nullable(),
  }),
  identityConfirmed: z.literal(false),
});
export type DspSongListing = z.infer<typeof dspSongListingSchema>;
export type DspAlbumListing = z.infer<typeof dspAlbumListingSchema>;
export type DspMatchFlag = z.infer<typeof dspMatchFlagSchema>;
export type DspMatchEvidence = z.infer<typeof dspMatchEvidenceSchema>;
export type StorefrontListing = z.infer<typeof storefrontListingSchema>;
export type RecordingListing = z.infer<typeof recordingListingSchema>;
