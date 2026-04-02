import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/const", () => ({
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { callElevenLabsMusic } from "../callElevenLabsMusic";

describe("callElevenLabsMusic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ELEVENLABS_API_KEY", "test-xi-key");
  });

  it("sends JSON body with xi-api-key header", async () => {
    mockFetch.mockResolvedValue(new Response("audio-data", { status: 200 }));

    await callElevenLabsMusic("/v1/music", { prompt: "upbeat pop" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/music",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": "test-xi-key",
        },
        body: JSON.stringify({ prompt: "upbeat pop" }),
      }),
    );
  });

  it("appends output_format query param when provided", async () => {
    mockFetch.mockResolvedValue(new Response("audio-data", { status: 200 }));

    await callElevenLabsMusic("/v1/music", { prompt: "test" }, "mp3_44100_128");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("output_format=mp3_44100_128");
  });

  it("does not append output_format when not provided", async () => {
    mockFetch.mockResolvedValue(new Response("audio-data", { status: 200 }));

    await callElevenLabsMusic("/v1/music", { prompt: "test" });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).not.toContain("output_format");
  });

  it("throws when ELEVENLABS_API_KEY is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    await expect(callElevenLabsMusic("/v1/music", { prompt: "test" })).rejects.toThrow(
      "ELEVENLABS_API_KEY is not configured",
    );
  });
});
