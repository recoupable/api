import { z } from "zod";
import { DEFAULT_STOREFRONT } from "@/lib/apple/storefronts";
import type { AppleIsrcResult } from "@/lib/apple/types";
import { compareAppleMusicStorefronts } from "../providers/compareAppleMusicStorefronts";
import { appleStorefrontsSchema } from "../providers/dspListingTypes";
import { mapAppleMusicListings } from "../providers/mapAppleMusicListings";
import { runContextEnrichment } from "./runContextEnrichment";

const schema = z.strictObject({
  recordingSubjectId: z.uuid(),
  isrc: z
    .string()
    .transform(value => value.replace(/-/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)),
  storefronts: appleStorefrontsSchema.default([DEFAULT_STOREFRONT]),
  // Supplied by the server's collection policy, never a random automatic retry token.
  collectionVersion: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  artists: z.array(z.string().min(1).max(200)).min(1).max(20),
  durationMs: z.number().int().positive().max(7_200_000).optional(),
});
type AppleLookup = (params: {
  isrcs: string[];
  storefront: string;
}) => Promise<{ results: AppleIsrcResult[] | null; error: Error | null }>;
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  resolveRecording?: (owner: string, requestId: string, subjectId: string) => Promise<string>;
  /** Tests inject fixtures; the default lazily loads the developer-token-backed Apple lookup. */
  lookup?: AppleLookup;
  now?: () => Date;
};
const LIMITATIONS = [
  "Availability is observed per Apple Music storefront at one time; it is not a global takedown, release or rights status.",
  "A listing is store evidence about the recording; it confirms no identity, ownership, roster or rights relationship.",
  "Album listings are separate store objects; an album id is never a recording, song or release identifier here.",
  "Regional variants are compared only across the storefronts observed in this result.",
  "YouTube Music, music video, art track and uploader channel listings are typed but not collected by this module.",
];
const lookupUrl = (storefront: string, isrc: string) =>
  `https://api.music.apple.com/v1/catalog/${storefront}/songs?${new URLSearchParams({ "filter[isrc]": isrc })}`;

/**
 * Persist Apple Music listings for one recording ISRC across up to ten storefronts as one
 * observation, not confirmed identity. Each storefront is a separate declared source, so
 * regional availability stays in one current document. Requires the dsp_listings migration.
 */
export async function collectContextAppleMusicListings(
  actor: string,
  owner: string,
  requestId: string,
  input: z.input<typeof schema>,
  deps: Dependencies,
) {
  const args = schema.parse(input);
  const authorizeRecording = async () => {
    await deps.authorize(actor, owner);
    const resolve =
      deps.resolveRecording ??
      (await import("@/lib/supabase/context_requests/getContextRecordingIsrc"))
        .getContextRecordingIsrc;
    if ((await resolve(owner, requestId, args.recordingSubjectId)) !== args.isrc)
      throw new Error("ISRC does not match the context recording");
  };
  const now = () => (deps.now?.() ?? new Date()).toISOString();
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "apple-music-listings-v1",
      topic: "dsp_listings",
      subjectId: args.recordingSubjectId,
      provider: "apple_music",
      model: "none",
      evidenceKind: "observation",
      input: {
        isrc: args.isrc,
        storefronts: args.storefronts,
        collectionVersion: args.collectionVersion,
      },
      // Query provenance here; the exact returned payload is retained in the observed sources.
      sources: args.storefronts.map(storefront => ({
        url: lookupUrl(storefront, args.isrc),
        kind: "provider_metadata",
        content: {
          isrc: args.isrc,
          storefront,
          collectionVersion: args.collectionVersion,
          role: "lookup_request",
        },
      })),
    },
    {
      ...deps,
      authorize: authorizeRecording,
      call: async () => {
        const lookup =
          deps.lookup ?? (await import("@/lib/apple/getAppleSongsByIsrc")).getAppleSongsByIsrc;
        const observed = [];
        // Sequential on purpose: one storefront at a time, and any failure saves nothing.
        for (const storefront of args.storefronts) {
          const startedAt = now();
          const { results, error } = await lookup({ isrcs: [args.isrc], storefront });
          const finishedAt = now();
          if (error) throw error;
          const result = results?.find(entry => entry.isrc.toUpperCase() === args.isrc);
          if (!result) throw new Error("Apple Music lookup did not answer the requested ISRC");
          const listing = mapAppleMusicListings(
            {
              isrc: args.isrc,
              title: args.title,
              artists: args.artists,
              durationMs: args.durationMs,
              storefront,
              observedAt: startedAt,
            },
            result,
          );
          observed.push({ storefront, startedAt, finishedAt, result, listing });
        }
        const listings = compareAppleMusicStorefronts(
          { isrc: args.isrc, collectionVersion: args.collectionVersion },
          observed.map(entry => entry.listing),
        );
        return {
          content: {
            ...listings,
            matchedAgainst: {
              title: args.title,
              artists: args.artists,
              durationMs: args.durationMs ?? null,
            },
            limitations: LIMITATIONS,
          },
          coverage:
            listings.regionalComparison.listedStorefronts.length > 0 ? "partial" : "unknown",
          trace: {
            provider: "apple_music",
            requestedIsrc: args.isrc,
            storefronts: observed.map(({ storefront, startedAt, finishedAt, result }) => ({
              storefront,
              startedAt,
              finishedAt,
              found: result.found,
              songCount: result.songs.length,
            })),
          },
          observedSources: observed.map(({ storefront, startedAt, result }) => ({
            url: lookupUrl(storefront, args.isrc),
            kind: "provider_metadata",
            content: { observedAt: startedAt, storefront, payload: result },
          })),
          costUsd: null,
          costStatus: "unknown",
        };
      },
    },
  );
}
