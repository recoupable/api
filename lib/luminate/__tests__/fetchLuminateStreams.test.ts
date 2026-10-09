import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLuminateStreams } from "../fetchLuminateStreams";

const input = { isrc: "USAAA2400001", since: "2026-09-01", until: "2026-09-02" };
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv("LUMINATE_API_KEY", "test-key");
  vi.stubEnv("LUMINATE_USERNAME", "test-name");
  vi.stubEnv("LUMINATE_PASSWORD", "test-password");
});
describe("fetchLuminateStreams", () => {
  it("authenticates and reads a bounded worldwide daily series by ISRC", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "private-token", expires_in: 86400 }))
      .mockResolvedValueOnce(
        Response.json({
          id: "MR-test",
          isrc: input.isrc,
          location: "AA",
          start_date: input.since,
          end_date: input.until,
          metrics: [
            {
              name: "Streams",
              value: [{ name: "total", value: [{ date: input.since, value: 2 }] }],
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await fetchLuminateStreams(input);
    expect(fetcher.mock.calls[1][0]).toContain("id_type=isrc");
    expect(fetcher.mock.calls[1][0]).toContain("aggregate_interval=day");
    expect(result?.days[0].streams).toBe(2);
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
  it("returns unavailable for a missing recording, never zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: "t" }))
        .mockResolvedValueOnce(new Response(null, { status: 404 })),
    );
    expect(await fetchLuminateStreams(input)).toBeNull();
  });
  it("does not expose upstream error bodies or credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private-password", { status: 403 })),
    );
    await expect(fetchLuminateStreams(input)).rejects.toThrow(
      "Luminate authentication unavailable (HTTP 403)",
    );
  });
  it("rejects invalid identifiers before sending credentials", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(fetchLuminateStreams({ ...input, isrc: "../evil" })).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});
