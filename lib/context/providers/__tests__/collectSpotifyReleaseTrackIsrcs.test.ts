import { expect, it, vi } from "vitest";
import { collectSpotifyReleaseTrackIsrcs } from "../collectSpotifyReleaseTrackIsrcs";

const a = "AAAAAAAAAAAAAAAAAAAAAA";
const b = "BBBBBBBBBBBBBBBBBBBBBB";

it("does not turn a denied batch into a provider failure or start any lookup", async () => {
  const fetcher = vi.fn();
  await expect(
    collectSpotifyReleaseTrackIsrcs(
      [{ slotIndex: 0, spotifyTrackId: a }],
      "fixture-token",
      fetcher,
      async () => {
        throw new Error("Collection no longer permitted");
      },
    ),
  ).rejects.toThrow("Collection no longer permitted");
  expect(fetcher).not.toHaveBeenCalled();
});

it("checks each bounded batch after previous lookups settle", async () => {
  const slots = Array.from({ length: 7 }, (_, slotIndex) => ({
    slotIndex,
    spotifyTrackId: String(slotIndex).padStart(22, "A"),
  }));
  let active = 0,
    maximum = 0,
    completed = 0;
  const checkpoints: number[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    active++;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active--;
    completed++;
    return Response.json({
      id: String(url).split("/").at(-1),
      external_ids: { isrc: "USABC2600001" },
    });
  });
  const result = await collectSpotifyReleaseTrackIsrcs(
    slots,
    "fixture-token",
    fetcher,
    async () => {
      expect(active).toBe(0);
      checkpoints.push(completed);
    },
  );
  expect(checkpoints).toEqual([0, 5]);
  expect(maximum).toBe(5);
  expect(result.observations).toHaveLength(7);
  expect(fetcher).toHaveBeenCalledTimes(7);
});

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
