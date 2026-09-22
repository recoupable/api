import { describe, expect, it, vi } from "vitest";
import { fetchExpandedSpotifyContext } from "../fetchExpandedSpotifyContext";
const releaseId = "3vX9jU6Ix8t7XsAWLoZs10";
const artistId = "1QzqrU2lmiW9l1mSvliVoM";
describe("expanded Spotify context", () => {
  it("starts independent calls together, deduplicates artists and preserves provider fields", async () => {
    const pending: Array<() => void> = [];
    const fetcher = vi.fn(
      (url: string) =>
        new Promise<Response>(resolve =>
          pending.push(() =>
            resolve(
              Response.json(
                url.includes("albums")
                  ? {
                      id: releaseId,
                      name: "Release",
                      label: "Label",
                      external_ids: { upc: "123" },
                      tracks: { items: [], next: "more" },
                    }
                  : { id: artistId, name: "Artist", images: [] },
              ),
            ),
          ),
        ),
    );
    const run = fetchExpandedSpotifyContext(
      { releaseId, artistIds: [artistId, artistId] },
      "secret",
      fetcher as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    pending.forEach(f => f());
    const result = await run;
    expect(result.results[0].data).toMatchObject({
      label: "Label",
      external_ids: { upc: "123" },
      tracks: { next: "more" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("keeps a successful branch when another fails identity validation", async () => {
    const fetcher = vi.fn(async (url: string) =>
      Response.json(
        url.includes("albums")
          ? { id: releaseId, name: "Release", tracks: { items: [], next: null } }
          : { id: releaseId, name: "Wrong artist" },
      ),
    );
    const result = await fetchExpandedSpotifyContext(
      { releaseId, artistIds: [artistId] },
      "secret",
      fetcher as typeof fetch,
    );
    expect(result.results.map(r => r.status)).toEqual(["saved", "failed"]);
    expect(result.results[1].error).toMatch(/identity mismatch/);
  });
  it("rejects invalid identifiers before making calls", async () => {
    const fetcher = vi.fn();
    await expect(
      fetchExpandedSpotifyContext({ releaseId: "bad", artistIds: [artistId] }, "secret", fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
