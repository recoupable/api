import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callMeasureSongMoments } from "../callMeasureSongMoments";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const measured = {
  duration_seconds: 180,
  tempo_bpm: 120,
  loudness_lufs: -9,
  ending: "fade",
  names_from: "lyrics",
  sections: [],
  moments: [],
  energy_curve: [],
  elapsed_seconds: 3.2,
};

describe("callMeasureSongMoments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts the audio and section order with Modal proxy auth", async () => {
    vi.stubEnv("MODAL_PROXY_TOKEN_ID", "wk-id");
    vi.stubEnv("MODAL_PROXY_TOKEN_SECRET", "ws-secret");
    mockFetch.mockResolvedValue({ ok: true, json: async () => measured });

    const result = await callMeasureSongMoments({
      audio_url: "https://example.com/song.mp3",
      section_order: ["Verse", "Chorus"],
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://shared-78369--song-moments-measure.modal.run");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
      "Modal-Key": "wk-id",
      "Modal-Secret": "ws-secret",
    });
    expect(JSON.parse(options.body)).toEqual({
      audio_url: "https://example.com/song.mp3",
      section_order: ["Verse", "Chorus"],
    });
    expect(result).toEqual(measured);
  });

  it("throws with the status when Modal refuses", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422, text: async () => "not audio" });

    await expect(callMeasureSongMoments({ audio_url: "https://example.com/x" })).rejects.toThrow(
      "Song measurement failed (status 422)",
    );
  });

  it("throws on an unexpected response shape", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sections: [] }) });

    await expect(callMeasureSongMoments({ audio_url: "https://example.com/x" })).rejects.toThrow(
      "unexpected response shape",
    );
  });
});
