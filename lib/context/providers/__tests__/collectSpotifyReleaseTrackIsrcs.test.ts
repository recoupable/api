import { expect, it, vi } from "vitest";
import { collectSpotifyReleaseTrackIsrcs } from "../collectSpotifyReleaseTrackIsrcs";

const a = "AAAAAAAAAAAAAAAAAAAAAA";
const b = "BBBBBBBBBBBBBBBBBBBBBB";

it("looks up each distinct track once while preserving repeated release positions", async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify({ id: url.endsWith(a) ? a : b, external_ids: { isrc: "usabc2600001" } }),
        {
          status: 200,
        },
      ),
  );
  const result = await collectSpotifyReleaseTrackIsrcs(
    [
      { slotIndex: 0, spotifyTrackId: a },
      { slotIndex: 1, spotifyTrackId: a },
      { slotIndex: 2, spotifyTrackId: b },
    ],
    "fixture-token",
    fetcher as unknown as typeof fetch,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.slots).toEqual([
    { slotIndex: 0, spotifyTrackId: a, state: "observed", isrc: "USABC2600001" },
    { slotIndex: 1, spotifyTrackId: a, state: "observed", isrc: "USABC2600001" },
    { slotIndex: 2, spotifyTrackId: b, state: "observed", isrc: "USABC2600001" },
  ]);
  expect(result.observations[0]).toMatchObject({
    sourceUrl: `https://api.spotify.com/v1/tracks/${a}`,
    httpStatus: 200,
  });
  expect(result.providerCostUsd).toBeNull();
});

it("leaves absent ISRC and mismatched responses unresolved", async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith(a) ? { id: a } : { id: a, external_ids: { isrc: "USABC2600002" } },
        ),
        { status: 200 },
      ),
  );
  const result = await collectSpotifyReleaseTrackIsrcs(
    [
      { slotIndex: 0, spotifyTrackId: a },
      { slotIndex: 1, spotifyTrackId: b },
    ],
    "fixture-token",
    fetcher as unknown as typeof fetch,
  );
  expect(result.slots).toMatchObject([
    { state: "missing_isrc", isrc: null },
    { state: "failed", isrc: null },
  ]);
  expect(result.observations[1].raw).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("rejects duplicate slot positions before calling Spotify", async () => {
  const fetcher = vi.fn();
  await expect(
    collectSpotifyReleaseTrackIsrcs(
      [
        { slotIndex: 0, spotifyTrackId: a },
        { slotIndex: 0, spotifyTrackId: b },
      ],
      "fixture-token",
      fetcher,
    ),
  ).rejects.toThrow("Duplicate release slot position");
  expect(fetcher).not.toHaveBeenCalled();
});

it("records a rate-limit gap without retrying or hiding other observations", async () => {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith(a)
      ? new Response(null, { status: 429 })
      : new Response(JSON.stringify({ id: b, external_ids: { isrc: "USABC2600002" } }), {
          status: 200,
        }),
  );
  const result = await collectSpotifyReleaseTrackIsrcs(
    [
      { slotIndex: 0, spotifyTrackId: a },
      { slotIndex: 1, spotifyTrackId: b },
    ],
    "fixture-token",
    fetcher as unknown as typeof fetch,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.observations[0]).toMatchObject({
    state: "failed",
    httpStatus: 429,
    gap: "Spotify HTTP 429",
  });
  expect(result.observations[1]).toMatchObject({ state: "observed", isrc: "USABC2600002" });
});
