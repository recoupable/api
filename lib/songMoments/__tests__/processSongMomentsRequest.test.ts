import { describe, it, expect, vi, beforeEach } from "vitest";
import { processSongMomentsRequest } from "../processSongMomentsRequest";
import { callMeasureSongMoments } from "@/lib/songMoments/callMeasureSongMoments";
import { chargeForSongMeasure } from "@/lib/songMoments/chargeForSongMeasure";
import { describeMoments } from "@/lib/songMoments/describeMoments";
import { chargeForBatchAnswers } from "@/lib/flamingo/chargeForBatchAnswers";
import type { MeasuredSong } from "@/lib/songMoments/isMeasuredSong";

vi.mock("@/lib/songMoments/callMeasureSongMoments", () => ({ callMeasureSongMoments: vi.fn() }));
vi.mock("@/lib/songMoments/chargeForSongMeasure", () => ({ chargeForSongMeasure: vi.fn() }));
vi.mock("@/lib/songMoments/describeMoments", () => ({ describeMoments: vi.fn() }));
vi.mock("@/lib/flamingo/chargeForBatchAnswers", () => ({ chargeForBatchAnswers: vi.fn() }));

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
  measured_with: "song-moments-2026-11-04",
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
const described = (...types: ("vocal_hook" | "climax")[]) =>
  new Map(types.map(type => [type, { description: words, elapsed_seconds: 2 }]));

describe("processSongMomentsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callMeasureSongMoments).mockResolvedValue(song);
    vi.mocked(describeMoments).mockResolvedValue(described("vocal_hook", "climax"));
  });

  it("measures, charges the measurement, and describes every moment in one charged batch", async () => {
    const result = await processSongMomentsRequest(
      { audio_url: audio, section_order: ["Verse", "Chorus"], describe: true },
      { accountId: "acc_1" },
    );

    expect(callMeasureSongMoments).toHaveBeenCalledWith({
      audio_url: audio,
      section_order: ["Verse", "Chorus"],
    });
    expect(chargeForSongMeasure).toHaveBeenCalledWith({ accountId: "acc_1", audioUrl: audio });
    expect(describeMoments).toHaveBeenCalledTimes(1);
    expect(describeMoments).toHaveBeenCalledWith({ audioUrl: audio, moments: [hook, climax] });
    expect(chargeForBatchAnswers).toHaveBeenCalledTimes(1);
    expect(chargeForBatchAnswers).toHaveBeenCalledWith({
      accountId: "acc_1",
      answers: [...described("vocal_hook", "climax").values()],
      audioUrl: audio,
    });
    expect(result.moments[0]).toEqual({ ...hook, ...words });
    expect(result.sections).toEqual(song.sections);
  });

  it("passes a tempo hint to the measurement", async () => {
    await processSongMomentsRequest(
      { audio_url: audio, tempo_hint: 86, describe: false },
      { accountId: "acc_1" },
    );

    expect(callMeasureSongMoments).toHaveBeenCalledWith({ audio_url: audio, tempo_hint: 86 });
  });

  it("describes nothing, and charges no model time, when describe is false", async () => {
    const result = await processSongMomentsRequest(
      { audio_url: audio, describe: false },
      { accountId: "acc_1" },
    );

    expect(describeMoments).not.toHaveBeenCalled();
    expect(chargeForBatchAnswers).toHaveBeenCalledWith(expect.objectContaining({ answers: [] }));
    expect(result.moments).toEqual([hook, climax]);
  });

  it("describes only the listed moment types", async () => {
    vi.mocked(describeMoments).mockResolvedValue(described("climax"));

    const result = await processSongMomentsRequest(
      { audio_url: audio, describe: ["climax"] },
      { accountId: "acc_1" },
    );

    expect(describeMoments).toHaveBeenCalledWith({ audioUrl: audio, moments: [climax] });
    expect(result.moments).toEqual([hook, { ...climax, ...words }]);
  });

  it("returns a moment without words, and charges nothing for it, when the model drops it", async () => {
    vi.mocked(describeMoments).mockResolvedValue(described("vocal_hook"));

    const result = await processSongMomentsRequest(
      { audio_url: audio, describe: true },
      { accountId: "acc_1" },
    );

    expect(result.moments[1]).toEqual(climax);
    const [charge] = vi.mocked(chargeForBatchAnswers).mock.calls[0];
    expect(charge.answers).toEqual([...described("vocal_hook").values()]);
  });

  it("returns every moment without words, and charges no model time, when the batch fails", async () => {
    vi.mocked(describeMoments).mockRejectedValue(new Error("Music analysis failed (status 503)"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await processSongMomentsRequest(
      { audio_url: audio, describe: true },
      { accountId: "acc_1" },
    );

    expect(result.moments).toEqual([hook, climax]);
    expect(chargeForSongMeasure).toHaveBeenCalledTimes(1);
    expect(chargeForBatchAnswers).toHaveBeenCalledWith(expect.objectContaining({ answers: [] }));
    errorSpy.mockRestore();
  });

  it("charges nothing when the measurement fails", async () => {
    vi.mocked(callMeasureSongMoments).mockRejectedValue(
      new Error("Song measurement failed (status 422)"),
    );

    await expect(
      processSongMomentsRequest({ audio_url: audio, describe: true }, { accountId: "acc_1" }),
    ).rejects.toThrow("status 422");
    expect(chargeForSongMeasure).not.toHaveBeenCalled();
    expect(describeMoments).not.toHaveBeenCalled();
  });
});
