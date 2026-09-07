import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeAudioUrl } from "../probeAudioUrl";

const URL = "https://cdn.example.com/track.mp3";

describe("probeAudioUrl", () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a HEAD with a timeout signal and no extra headers", async () => {
    await probeAudioUrl(URL, "HEAD", Date.now() + 5_000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe("HEAD");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toBeUndefined();
  });

  it("sends a one-byte ranged GET", async () => {
    await probeAudioUrl(URL, "GET", Date.now() + 5_000);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Range: "bytes=0-0" });
  });

  it("still fires with a minimal timeout once the deadline has passed", async () => {
    await probeAudioUrl(URL, "HEAD", Date.now() - 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
  });
});
