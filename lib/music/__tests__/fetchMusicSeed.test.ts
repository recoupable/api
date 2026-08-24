import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMusicSeed } from "../fetchMusicSeed";
import fal from "@/lib/fal/server";

vi.mock("@/lib/fal/server", () => ({ default: { queue: { result: vi.fn() } } }));

const result = vi.mocked(fal.queue.result);

describe("fetchMusicSeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the seed fal actually used back off the finished result", async () => {
    result.mockResolvedValue({ data: { audio: { url: "https://fal/a.wav" }, seed: 42 } } as never);

    const seed = await fetchMusicSeed("req_1", "completed");

    expect(result).toHaveBeenCalledWith("minimax/music-3", { requestId: "req_1" });
    expect(seed).toBe(42);
  });

  it("reads a seed returned at the top level rather than under data", async () => {
    result.mockResolvedValue({ audio: { url: "https://fal/a.wav" }, seed: 7 } as never);

    await expect(fetchMusicSeed("req_1", "completed")).resolves.toBe(7);
  });

  it("does not call fal while the song is still rendering", async () => {
    // The detail read is polled during a render. Nothing has a seed until fal
    // finishes, so spending a round trip per poll would buy nothing.
    await expect(fetchMusicSeed("req_1", "processing")).resolves.toBeNull();

    expect(result).not.toHaveBeenCalled();
  });

  it("returns null for a generation that never reached fal", async () => {
    await expect(fetchMusicSeed(null, "completed")).resolves.toBeNull();

    expect(result).not.toHaveBeenCalled();
  });

  it("swallows a fal outage rather than failing the generation read", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    result.mockRejectedValue(new Error("fal is down"));

    await expect(fetchMusicSeed("req_1", "completed")).resolves.toBeNull();

    consoleSpy.mockRestore();
  });

  it("returns null when the result carries no seed", async () => {
    result.mockResolvedValue({ data: { audio: { url: "https://fal/a.wav" } } } as never);

    await expect(fetchMusicSeed("req_1", "completed")).resolves.toBeNull();
  });

  it("ignores a non-numeric seed rather than passing it through", async () => {
    result.mockResolvedValue({ data: { seed: "not-a-number" } } as never);

    await expect(fetchMusicSeed("req_1", "completed")).resolves.toBeNull();
  });
});
