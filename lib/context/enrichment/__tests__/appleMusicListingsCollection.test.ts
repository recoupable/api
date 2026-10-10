import { expect, it, vi } from "vitest";
import type { AppleIsrcResult, AppleSong } from "@/lib/apple/types";
import { collectContextAppleMusicListings } from "../collectContextAppleMusicListings";

// The ISRC is the synthetic value the other Context suites use; ids are fixture strings.
const ISRC = "USAT22103065";
const input = {
  recordingSubjectId: "00000000-0000-4000-8000-000000000001",
  isrc: "US-AT2-21-03065",
  collectionVersion: "fixture-v1",
  title: "Song",
  artists: ["Artist"],
  durationMs: 180_000,
};
function song(albumId: string, storefront: string): AppleSong {
  return {
    id: "1001",
    isrc: ISRC,
    name: "Song",
    artist_name: "Artist",
    composer_name: null,
    album_name: "Album",
    release_date: null,
    duration_ms: 180_000,
    track_number: null,
    disc_number: null,
    genre_names: [],
    has_lyrics: false,
    is_apple_digital_master: false,
    audio_variants: [],
    url: `https://music.apple.com/${storefront}/album/album/${albumId}?i=1001`,
    artwork_url: null,
    preview_url: null,
    album: {
      id: albumId,
      name: "Album",
      upc: null,
      record_label: null,
      copyright: null,
      release_date: null,
      track_count: null,
      is_single: false,
      is_compilation: false,
      is_complete: true,
      url: `https://music.apple.com/${storefront}/album/album/${albumId}`,
    },
  };
}
const listed = (albumId = "2001", storefront = "us"): AppleIsrcResult => ({
  isrc: ISRC,
  found: true,
  songs: [song(albumId, storefront)],
});
const notListed: AppleIsrcResult = { isrc: ISRC, found: false, songs: [] };
type Lookup = (params: {
  isrcs: string[];
  storefront: string;
}) => Promise<{ results: AppleIsrcResult[] | null; error: Error | null }>;
function dependencies(byStorefront: Record<string, AppleIsrcResult> = { us: listed() }) {
  return {
    authorize: vi.fn(async () => undefined),
    resolveRecording: vi.fn(async () => ISRC),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: "attempt" }
          : { state: "saved" },
    ),
    lookup: vi.fn<Lookup>(async ({ storefront }) => ({
      results: [byStorefront[storefront] ?? notListed],
      error: null,
    })),
  };
}
type RpcCall = [string, { p_module: { fingerprint: string }; p_result: Record<string, unknown> }];
const completion = (d: ReturnType<typeof dependencies>) =>
  (d.rpc.mock.calls as unknown as RpcCall[]).find(
    ([name]) => name === "complete_context_enrichment",
  )?.[1].p_result;

it("claims an observation module keyed by ISRC, storefronts and version", async () => {
  const d = dependencies();
  await collectContextAppleMusicListings("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "claim_context_enrichment",
    expect.objectContaining({
      p_owner: "owner",
      p_request: "request",
      p_module: expect.objectContaining({
        key: "apple-music-listings-v1",
        topic: "dsp_listings",
        subjectId: input.recordingSubjectId,
        provider: "apple_music",
        model: "none",
        evidenceKind: "observation",
        input: { isrc: ISRC, storefronts: ["us"], collectionVersion: "fixture-v1" },
        sources: [
          expect.objectContaining({
            kind: "provider_metadata",
            url: expect.stringContaining("api.music.apple.com/v1/catalog/us/songs"),
            content: expect.objectContaining({ isrc: ISRC, storefront: "us" }),
          }),
        ],
      }),
    }),
  );
  expect(d.lookup).toHaveBeenCalledWith({ isrcs: [ISRC], storefront: "us" });
});

it("saves mapped listings with the raw provider payload as a versioned source and no cost claim", async () => {
  const d = dependencies();
  await collectContextAppleMusicListings("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_attempt: "attempt",
      p_result: expect.objectContaining({
        coverage: "partial",
        costUsd: null,
        costStatus: "unknown",
        content: expect.objectContaining({
          provider: "apple_music",
          isrc: ISRC,
          collectionVersion: "fixture-v1",
          identityConfirmed: false,
          storefronts: [
            expect.objectContaining({
              storefront: "us",
              availability: { status: "listed", storefront: "us" },
              match: expect.objectContaining({ status: "exact_isrc" }),
              songListings: [
                expect.objectContaining({
                  resourceType: "song",
                  providerId: "1001",
                  albumListing: expect.objectContaining({
                    resourceType: "album",
                    providerId: "2001",
                  }),
                }),
              ],
            }),
          ],
          regionalComparison: expect.objectContaining({ varies: null }),
          limitations: expect.arrayContaining([expect.stringMatching(/storefront/i)]),
        }),
        trace: expect.objectContaining({
          provider: "apple_music",
          storefronts: [expect.objectContaining({ storefront: "us", found: true, songCount: 1 })],
        }),
        observedSources: [
          expect.objectContaining({
            kind: "provider_metadata",
            url: expect.stringContaining("api.music.apple.com/v1/catalog/us/songs"),
            content: expect.objectContaining({ storefront: "us", payload: listed() }),
          }),
        ],
      }),
    }),
  );
});

it("observes several storefronts in one saved result and flags a regional album variant", async () => {
  const d = dependencies({ us: listed("2001", "us"), jp: listed("2009", "jp") });
  await collectContextAppleMusicListings(
    "actor",
    "owner",
    "request",
    { ...input, storefronts: ["us", "JP", "us"] },
    d,
  );
  expect(d.lookup.mock.calls.map(([params]) => params.storefront)).toEqual(["jp", "us"]);
  const claim = (d.rpc.mock.calls as unknown as RpcCall[]).find(
    ([name]) => name === "claim_context_enrichment",
  )?.[1].p_module as unknown as {
    input: unknown;
    sources: Array<{ url: string }>;
  };
  expect(claim.input).toEqual({
    isrc: ISRC,
    storefronts: ["jp", "us"],
    collectionVersion: "fixture-v1",
  });
  expect(claim.sources.map(source => source.url)).toEqual([
    expect.stringContaining("/catalog/jp/songs"),
    expect.stringContaining("/catalog/us/songs"),
  ]);
  const result = completion(d) as {
    content: {
      storefronts: Array<{ storefront: string; match: { flags: string[] } }>;
      regionalComparison: unknown;
    };
    observedSources: Array<{ url: string; content: { storefront: string } }>;
  };
  expect(result.content.storefronts.map(s => [s.storefront, s.match.flags])).toEqual([
    ["jp", ["regional_variant"]],
    ["us", ["regional_variant"]],
  ]);
  expect(result.content.regionalComparison).toEqual({
    listedStorefronts: ["jp", "us"],
    songProviderIds: ["1001"],
    albumProviderIds: ["2001", "2009"],
    varies: true,
  });
  expect(result.observedSources.map(source => source.content.storefront)).toEqual(["jp", "us"]);
});

it("keeps storefront order out of the fingerprint but isolates storefront sets and versions", async () => {
  const d = dependencies();
  d.rpc.mockResolvedValue({ state: "reused" });
  await collectContextAppleMusicListings(
    "actor",
    "owner",
    "request",
    { ...input, storefronts: ["us", "gb"] },
    d,
  );
  await collectContextAppleMusicListings(
    "actor",
    "owner",
    "request",
    { ...input, storefronts: ["gb", "us"] },
    d,
  );
  await collectContextAppleMusicListings(
    "actor",
    "owner",
    "request",
    { ...input, storefronts: ["us"] },
    d,
  );
  await collectContextAppleMusicListings(
    "actor",
    "owner",
    "request",
    { ...input, storefronts: ["us"], collectionVersion: "fixture-v2" },
    d,
  );
  expect(d.lookup).not.toHaveBeenCalled();
  const fingerprints = (d.rpc.mock.calls as unknown as RpcCall[]).map(
    ([, params]) => params.p_module.fingerprint,
  );
  expect(fingerprints).toHaveLength(4);
  expect(fingerprints[0]).toBe(fingerprints[1]);
  expect(new Set(fingerprints).size).toBe(3);
});

it("records storefronts where the ISRC is not listed as unknown coverage", async () => {
  const d = dependencies({});
  await collectContextAppleMusicListings(
    "actor",
    "owner",
    "request",
    { ...input, storefronts: ["us", "jp"] },
    d,
  );
  expect(completion(d)).toMatchObject({
    coverage: "unknown",
    content: {
      storefronts: [
        {
          storefront: "jp",
          availability: { status: "not_listed", storefront: "jp" },
          songListings: [],
        },
        {
          storefront: "us",
          availability: { status: "not_listed", storefront: "us" },
          songListings: [],
        },
      ],
      regionalComparison: { listedStorefronts: [], varies: null },
    },
  });
});

it("rejects a recording whose ISRC does not match before claim, reuse or lookup", async () => {
  const d = dependencies();
  d.resolveRecording.mockResolvedValue("USAT22199999");
  d.rpc.mockResolvedValue({ state: "reused" });
  await expect(
    collectContextAppleMusicListings("actor", "owner", "request", input, d),
  ).rejects.toThrow("ISRC does not match");
  expect(d.rpc).not.toHaveBeenCalled();
  expect(d.lookup).not.toHaveBeenCalled();
});

it("rejects an unknown, empty or oversized storefront list before authorization, claim or lookup", async () => {
  const d = dependencies();
  const eleven = ["us", "gb", "jp", "de", "fr", "ca", "au", "br", "mx", "kr", "in"];
  for (const storefronts of [["zz"], [], eleven]) {
    await expect(
      collectContextAppleMusicListings("actor", "owner", "request", { ...input, storefronts }, d),
    ).rejects.toThrow(/storefronts/);
  }
  expect(d.authorize).not.toHaveBeenCalled();
  expect(d.rpc).not.toHaveBeenCalled();
  expect(d.lookup).not.toHaveBeenCalled();
});

it("saves nothing and marks the attempt failed when any storefront lookup fails", async () => {
  const d = dependencies();
  d.lookup.mockImplementation(async ({ storefront }) =>
    storefront === "us"
      ? { results: [listed()], error: null }
      : { results: null, error: new Error("Apple Music API responded 503") },
  );
  await expect(
    collectContextAppleMusicListings(
      "actor",
      "owner",
      "request",
      { ...input, storefronts: ["us", "jp"] },
      d,
    ),
  ).rejects.toThrow("503");
  expect(completion(d)).toBeUndefined();
  expect(d.rpc).toHaveBeenCalledWith("fail_context_enrichment", expect.anything());
});

it("refuses to save when the lookup omits the requested ISRC", async () => {
  const d = dependencies({ us: { ...notListed, isrc: "USAT22199999" } });
  await expect(
    collectContextAppleMusicListings("actor", "owner", "request", input, d),
  ).rejects.toThrow(/ISRC/);
  expect(completion(d)).toBeUndefined();
});

it("rechecks recording access after lookup and refuses to save detached evidence", async () => {
  const d = dependencies();
  d.lookup.mockImplementation(async () => {
    d.resolveRecording.mockRejectedValue(new Error("Recording no longer attached"));
    return { results: [listed()], error: null };
  });
  await expect(
    collectContextAppleMusicListings("actor", "owner", "request", input, d),
  ).rejects.toThrow("Recording no longer attached");
  expect(completion(d)).toBeUndefined();
  expect(d.rpc).toHaveBeenCalledWith("fail_context_enrichment", expect.anything());
});
