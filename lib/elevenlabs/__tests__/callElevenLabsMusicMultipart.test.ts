import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/const", () => ({
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { callElevenLabsMusicMultipart } from "../callElevenLabsMusicMultipart";

describe("callElevenLabsMusicMultipart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ELEVENLABS_API_KEY", "test-xi-key");
  });

  it("sends FormData with xi-api-key header", async () => {
    mockFetch.mockResolvedValue(new Response("zip-data", { status: 200 }));

    const formData = new FormData();
    formData.append("file", new Blob(["audio"]), "test.mp3");

    await callElevenLabsMusicMultipart("/v1/music/stem-separation", formData);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/music/stem-separation",
      expect.objectContaining({
        method: "POST",
        headers: { "xi-api-key": "test-xi-key" },
        body: formData,
      }),
    );
  });

  it("does not set Content-Type header (lets fetch auto-set multipart boundary)", async () => {
    mockFetch.mockResolvedValue(new Response("data", { status: 200 }));

    const formData = new FormData();
    await callElevenLabsMusicMultipart("/v1/music/stem-separation", formData);

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it("appends output_format query param when provided", async () => {
    mockFetch.mockResolvedValue(new Response("data", { status: 200 }));

    const formData = new FormData();
    await callElevenLabsMusicMultipart("/v1/music/stem-separation", formData, "mp3_44100_128");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("output_format=mp3_44100_128");
  });

  it("throws when ELEVENLABS_API_KEY is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    const formData = new FormData();
    await expect(
      callElevenLabsMusicMultipart("/v1/music/stem-separation", formData),
    ).rejects.toThrow("ELEVENLABS_API_KEY is not configured");
  });
});
