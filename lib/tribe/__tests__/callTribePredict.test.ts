import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTribePredict } from "../callTribePredict";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const VALID_RESPONSE = {
  engagement_score: 73.2,
  engagement_timeline: [{ time_seconds: 0, score: 45.1 }],
  peak_moments: [{ time_seconds: 12.0, score: 95.4 }],
  weak_spots: [{ time_seconds: 6.0, score: 22.1 }],
  regional_activation: { visual_cortex: 0.72, auditory_cortex: 0.85 },
  total_duration_seconds: 60.0,
  elapsed_seconds: 14.2,
};

describe("callTribePredict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends correct payload to Modal endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });

    await callTribePredict({
      file_url: "https://example.com/video.mp4",
      modality: "video",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: "https://example.com/video.mp4",
          modality: "video",
        }),
      }),
    );
  });

  it("returns parsed response on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });

    const result = await callTribePredict({
      file_url: "https://example.com/video.mp4",
      modality: "video",
    });

    expect(result.engagement_score).toBe(73.2);
    expect(result.engagement_timeline).toHaveLength(1);
    expect(result.peak_moments).toHaveLength(1);
    expect(result.weak_spots).toHaveLength(1);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(
      callTribePredict({
        file_url: "https://example.com/video.mp4",
        modality: "video",
      }),
    ).rejects.toThrow("Engagement prediction failed (status 500)");
  });

  it("throws on unexpected response shape", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unexpected: "data" }),
    });

    await expect(
      callTribePredict({
        file_url: "https://example.com/video.mp4",
        modality: "video",
      }),
    ).rejects.toThrow("unexpected response shape");
  });
});
