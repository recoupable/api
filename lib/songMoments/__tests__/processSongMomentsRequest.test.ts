import { describe, it, expect, vi, beforeEach } from "vitest";
import { processSongMomentsRequest } from "../processSongMomentsRequest";
import { callMeasureSongMoments } from "@/lib/songMoments/callMeasureSongMoments";
import { chargeForSongMeasure } from "@/lib/songMoments/chargeForSongMeasure";
import { describeMoment } from "@/lib/songMoments/describeMoment";
import { chargeForFlamingoCall } from "@/lib/flamingo/chargeForFlamingoCall";
import type { MeasuredSong } from "@/lib/songMoments/isMeasuredSong";

vi.mock("@/lib/songMoments/callMeasureSongMoments", () => ({ callMeasureSongMoments: vi.fn() }));
vi.mock("@/lib/songMoments/chargeForSongMeasure", () => ({ chargeForSongMeasure: vi.fn() }));
vi.mock("@/lib/songMoments/describeMoment", () => ({ describeMoment: vi.fn() }));
vi.mock("@/lib/flamingo/chargeForFlamingoCall", () => ({ chargeForFlamingoCall: vi.fn() }));

const audio = "https://example.com/song.mp3";
const hook = {
  type: "vocal_hook" as const,
  start: 36.15,
  end: 50.9,
  section: "chorus",
  energy: 92,
  cuts: { "6": [36.15, 42.05] as [number, number] },
};
const climax = { ...hook, type: "climax" as const, start: 143.36, end: 158.1 };
const song: MeasuredSong = {
  duration_seconds: 169.4,
  tempo_bpm: 123,
  loudness_lufs: -12.9,
  ending: "fade",
  names_from: "lyrics",
  sections: [{ label: "chorus", start: 36.15, end: 51.4, group: "D", energy: 92 }],
  moments: [hook, climax],
  energy_curve: [10, 50, 90],
  elapsed_seconds: 3.1,
};
const words = {
  description: "The chorus lands.",
  emotion: ["euphoric"],
  best_for: ["ad"],
  vocals: true,
};

describe("processSongMomentsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callMeasureSongMoments).mockResolvedValue(song);
    vi.mocked(describeMoment).mockResolvedValue({ description: words, elapsed_seconds: 2 });
  });

  it("measures, charges the measurement, and describes and charges every moment", async () => {
    const result = await processSongMomentsRequest(
      { audio_url: audio, section_order: ["Verse", "Chorus"], describe: true },
      { accountId: "acc_1" },
    );

    expect(callMeasureSongMoments).toHaveBeenCalledWith({
      audio_url: audio,
      section_order: ["Verse", "Chorus"],
    });
    expect(chargeForSongMeasure).toHaveBeenCalledWith({ accountId: "acc_1", audioUrl: audio });
    expect(describeMoment).toHaveBeenCalledWith({ audioUrl: audio, start: 36.15, end: 50.9 });
    expect(describeMoment).toHaveBeenCalledTimes(2);
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(2);
    expect(chargeForFlamingoCall).toHaveBeenCalledWith({
      accountId: "acc_1",
      elapsedSeconds: 2,
      audioUrl: audio,
    });
    expect(result.moments[0]).toEqual({ ...hook, ...words });
    expect(result.sections).toEqual(song.sections);
  });

  it("describes nothing when describe is false", async () => {
    const result = await processSongMomentsRequest(
      { audio_url: audio, describe: false },
      { accountId: "acc_1" },
    );

    expect(describeMoment).not.toHaveBeenCalled();
    expect(chargeForFlamingoCall).not.toHaveBeenCalled();
    expect(result.moments).toEqual([hook, climax]);
  });

  it("describes only the listed moment types", async () => {
    await processSongMomentsRequest(
      { audio_url: audio, describe: ["climax"] },
      { accountId: "acc_1" },
    );

    expect(describeMoment).toHaveBeenCalledTimes(1);
    expect(describeMoment).toHaveBeenCalledWith({ audioUrl: audio, start: 143.36, end: 158.1 });
  });

  it("returns a moment without words, and charges nothing for it, when its description fails", async () => {
    vi.mocked(describeMoment)
      .mockResolvedValueOnce({ description: words, elapsed_seconds: 2 })
      .mockRejectedValueOnce(new Error("Music analysis failed (status 503)"));

    const result = await processSongMomentsRequest(
      { audio_url: audio, describe: true },
      { accountId: "acc_1" },
    );

    expect(result.moments[1]).toEqual(climax);
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(1);
  });

  it("charges nothing when the measurement fails", async () => {
    vi.mocked(callMeasureSongMoments).mockRejectedValue(
      new Error("Song measurement failed (status 422)"),
    );

    await expect(
      processSongMomentsRequest({ audio_url: audio, describe: true }, { accountId: "acc_1" }),
    ).rejects.toThrow("status 422");
    expect(chargeForSongMeasure).not.toHaveBeenCalled();
    expect(describeMoment).not.toHaveBeenCalled();
  });
});
