import { describe, it, expect, vi, beforeEach } from "vitest";
import { callFlamingoGenerate } from "../callFlamingoGenerate";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("callFlamingoGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns model response on successful call", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "This track is a jazz piece in Bb major at 120 BPM.",
        elapsed_seconds: 3.21,
      }),
    });

    const result = await callFlamingoGenerate({
      prompt: "Describe this track.",
      audio_url: "https://example.com/song.mp3",
    });

    expect(result).toEqual({
      response: "This track is a jazz piece in Bb major at 120 BPM.",
      elapsed_seconds: 3.21,
    });
  });

  it("sends correct payload to Modal endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: "test", elapsed_seconds: 1.0 }),
    });

    await callFlamingoGenerate({
      prompt: "What key is this?",
      audio_url: "https://example.com/track.wav",
      max_new_tokens: 256,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("music-flamingo");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      prompt: "What key is this?",
      audio_url: "https://example.com/track.wav",
      max_new_tokens: 256,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
    });
  });

  it("uses default values when optional params are omitted", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: "test", elapsed_seconds: 1.0 }),
    });

    await callFlamingoGenerate({ prompt: "Describe jazz." });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      prompt: "Describe jazz.",
      audio_url: null,
      max_new_tokens: 512,
      temperature: 1.0,
      top_p: 1.0,
      do_sample: false,
    });
  });

  it("throws error when Modal returns non-OK status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(
      callFlamingoGenerate({ prompt: "Describe this." }),
    ).rejects.toThrow("Flamingo model returned 503: Service Unavailable");
  });

  it("throws error with fallback message when error text cannot be read", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error("Cannot read body");
      },
    });

    await expect(
      callFlamingoGenerate({ prompt: "Describe this." }),
    ).rejects.toThrow("Flamingo model returned 500: Unknown error");
  });
});
