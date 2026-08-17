import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAppleSongsByIsrc } from "../getAppleSongsByIsrc";

vi.mock("../generateDeveloperToken", () => ({
  generateDeveloperToken: () => "test-developer-token",
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

const song = (id: string, isrc: string) => ({
  id,
  type: "songs",
  attributes: { id, isrc, name: `song ${id}` },
});

/** Apple's real envelope: `data` carries the matches, `meta.filters` echoes every request. */
const appleResponse = (matches: Record<string, string[]>) => ({
  ok: true,
  json: async () => ({
    data: Object.entries(matches).flatMap(([isrc, ids]) => ids.map(id => song(id, isrc))),
    meta: {
      filters: {
        isrc: Object.fromEntries(
          Object.entries(matches).map(([isrc, ids]) => [
            isrc,
            ids.map(id => ({ id, type: "songs" })),
          ]),
        ),
      },
    },
  }),
});

describe("getAppleSongsByIsrc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a row for an ISRC Apple does not carry, rather than omitting it", async () => {
    mockFetch.mockResolvedValue(
      appleResponse({ DEH742611917: ["1894880802"], TCAEC1931080: [] }) as never,
    );

    const { results, error } = await getAppleSongsByIsrc({
      isrcs: ["DEH742611917", "TCAEC1931080"],
      storefront: "us",
    });

    expect(error).toBeNull();
    expect(results).toEqual([
      { isrc: "DEH742611917", found: true, songs: [expect.objectContaining({ id: "1894880802" })] },
      { isrc: "TCAEC1931080", found: false, songs: [] },
    ]);
  });

  it("chunks at Apple's 25-value filter cap", async () => {
    const isrcs = Array.from({ length: 30 }, (_, i) => `TEST${String(i).padStart(8, "0")}`);
    mockFetch.mockResolvedValue(appleResponse({}) as never);

    await getAppleSongsByIsrc({ isrcs, storefront: "us" });

    // Apple accepts the percent-encoded comma; verified against the live API 2026-08-17.
    const requested = (call: number) =>
      new URL(mockFetch.mock.calls[call][0] as string).searchParams.get("filter[isrc]");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(requested(0)).toBe(isrcs.slice(0, 25).join(","));
    expect(requested(1)).toBe(isrcs.slice(25).join(","));
  });

  it("preserves the requested order across chunk boundaries", async () => {
    const isrcs = Array.from({ length: 30 }, (_, i) => `TEST${String(i).padStart(8, "0")}`);
    mockFetch.mockResolvedValue(appleResponse({}) as never);

    const { results } = await getAppleSongsByIsrc({ isrcs, storefront: "us" });

    expect(results?.map(r => r.isrc)).toEqual(isrcs);
  });

  it("returns every song when one ISRC appears on several releases", async () => {
    mockFetch.mockResolvedValue(appleResponse({ USUM71703861: ["a", "b", "c"] }) as never);

    const { results } = await getAppleSongsByIsrc({
      isrcs: ["USUM71703861"],
      storefront: "us",
    });

    expect(results?.[0].songs.map(s => s.id)).toEqual(["a", "b", "c"]);
  });

  it("requests the album relationship so rights metadata arrives in one round trip", async () => {
    mockFetch.mockResolvedValue(appleResponse({}) as never);

    await getAppleSongsByIsrc({ isrcs: ["DEH742611917"], storefront: "gb" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/v1/catalog/gb/songs");
    expect(url).toContain("include=albums");
    expect(mockFetch.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer test-developer-token" },
    });
  });

  // Apple returns 200 + an empty `data` for a miss, so a non-ok status is a real failure.
  it("surfaces an upstream failure as an error instead of an empty result", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    } as never);

    const { results, error } = await getAppleSongsByIsrc({
      isrcs: ["DEH742611917"],
      storefront: "us",
    });

    expect(results).toBeNull();
    expect(error?.message).toContain("401");
  });
});
