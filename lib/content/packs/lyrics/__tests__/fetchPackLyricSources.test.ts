import { it, expect, vi } from "vitest";
import { fetchPackLyricSources } from "../fetchPackLyricSources";
import type { PackLyricMediaCapability } from "../packLyricRenderTypes";
it("passes cancellation and byte limits to every local source leaf", async () => {
  const fetchMedia = vi.fn<PackLyricMediaCapability["fetchMedia"]>(async () => ({
    bytes: Buffer.from("x"),
    contentType: "audio/mp4",
  }));
  expect(
    await fetchPackLyricSources({ fetchMedia } as unknown as PackLyricMediaCapability, ["a", "b"]),
  ).toHaveLength(2);
  expect(fetchMedia).toHaveBeenCalledTimes(2);
  expect(fetchMedia).toHaveBeenNthCalledWith(1, "a", {
    signal: expect.any(AbortSignal),
    maxBytes: 50 * 1024 * 1024,
  });
  expect(fetchMedia).toHaveBeenNthCalledWith(2, "b", {
    signal: fetchMedia.mock.calls[0][1].signal,
    maxBytes: 50 * 1024 * 1024,
  });
});
it.each([true, false])(
  "cancels timed-out fetches and bounds settlement: cooperative=%s",
  async cooperative => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fetchMedia: PackLyricMediaCapability["fetchMedia"] = async (_url, options) => {
        signal = options.signal;
        return new Promise((_, reject) => {
          if (cooperative)
            signal!.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
        });
      };
      let failure: unknown;
      const result = fetchPackLyricSources({ fetchMedia } as PackLyricMediaCapability, ["a"]).catch(
        error => {
          failure = error;
        },
      );
      await vi.advanceTimersByTimeAsync(185001);
      expect(signal?.aborted).toBe(true);
      expect(String(failure)).toMatch(cooperative ? /fetch deadline/ : /cancellation unconfirmed/);
      await result;
    } finally {
      vi.useRealTimers();
    }
  },
);
