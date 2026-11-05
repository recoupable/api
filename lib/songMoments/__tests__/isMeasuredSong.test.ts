import { describe, it, expect } from "vitest";
import { isMeasuredSong } from "../isMeasuredSong";

const base = {
  measured_with: "song-moments-2026-11-04",
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

const arrangement = {
  percussive_pct: 18.9,
  onsets_per_s: 5.2,
  high_pct: 2.9,
  sub_pct: 74.9,
  rms_db: -14.5,
};

const extended = {
  ...base,
  measured_with: "song-moments-2026-11-04+extended-2026-11-04.2",
  sections: [{ label: "verse", start: 0, end: 38.99, group: "A", energy: 62, arrangement }],
  lufs: -9,
  true_peak_dbtp: -0.8,
  sample_peak_dbfs: -1.02,
  crest_factor_db: 14.8,
  loudness_range_lu: 7,
  broadcast_ready: false,
  stereo: { lr_correlation: 0.707, side_to_mid: 0.418 },
  spectral_centroid_hz: 2382,
  rolloff95_hz: 9044,
  band_profile: [
    {
      band: "sub",
      lo_hz: 20,
      hi_hz: 60,
      share_pct: 34.2,
      side_pct: 1.1,
      level_pct: 62,
      status: "clear",
    },
  ],
  fingerprint: {
    organic_electronic: 0.16,
    sparse_dense: 0.63,
    dark_bright: 0.37,
    intimate_anthemic: 0.62,
    smooth_textured: 0.38,
    slow_fast: 0.35,
  },
  fingerprint_inputs: {
    flatness: 0.0014,
    contrast_db: 22.6,
    zcr_std: 0.0336,
    perc_ratio: 0.154,
    onsets_per_s: 5.07,
  },
  key: { tonic: "G", mode: "minor", confidence: 0.6 },
  time_signature: "4/4",
  valence: 0.37,
  arousal: 0.66,
  mute_drops: [
    { type: "mute", start: 17.79, end: 18.39, beats: 0.9, depth_db: 12.4, mmss: "0:17" },
  ],
  chord_loop: {
    dominant_loop: "Gm Cm Gm Cm",
    loop_share: 0.17,
    distinct_chords: 5,
    bars: 79,
    confidence: "low",
  },
  edit_points: [
    { type: "in", time: 0, name: "Cold open (intro)", note: "Starts clean.", mmss: "0:00" },
  ],
  tempo_note: "beat tracker 117.5 reconciled to hint 86",
  ending_detail: { type: "stop_with_tail", stop_at: 221, tail_until: 230, mmss: "3:41" },
  arrangement_notes: ["sparse open", "band thins at 1:20"],
};

describe("isMeasuredSong", () => {
  it("accepts the base measurement without the extended fields", () => {
    expect(isMeasuredSong(base)).toBe(true);
  });

  it("accepts the extended measurement", () => {
    expect(isMeasuredSong(extended)).toBe(true);
  });

  it("accepts null where a measurement could not be made", () => {
    expect(
      isMeasuredSong({
        ...extended,
        true_peak_dbtp: null,
        loudness_range_lu: null,
        broadcast_ready: null,
      }),
    ).toBe(true);
  });

  it("accepts sections without an arrangement", () => {
    expect(
      isMeasuredSong({
        ...extended,
        sections: [{ label: "verse", start: 0, end: 38.99, group: "A", energy: 62 }],
      }),
    ).toBe(true);
  });

  it.each([
    { type: "fade", from: 37, silent_from: 40, mmss: "0:37" },
    { type: "stop", stop_at: 113, silent_from: 113, mmss: "1:53" },
  ])("accepts a $type ending", ending_detail => {
    expect(isMeasuredSong({ ...extended, ending_detail })).toBe(true);
  });

  it.each([
    ["a missing arrangement value", { ...arrangement, rms_db: undefined }],
    ["a string share", { ...arrangement, high_pct: "2.9" }],
    ["a list", [18.9, 5.2]],
  ])("rejects a section arrangement with %s", (_, value) => {
    const section = {
      label: "verse",
      start: 0,
      end: 38.99,
      group: "A",
      energy: 62,
      arrangement: value,
    };
    expect(isMeasuredSong({ ...extended, sections: [section] })).toBe(false);
  });

  it.each([
    ["band_profile", { sub: 34 }],
    ["broadcast_ready", "yes"],
    ["fingerprint", null],
    ["key", "G minor"],
    ["mute_drops", null],
    ["edit_points", {}],
    ["true_peak_dbtp", "-0.8"],
    ["time_signature", 4],
    ["arrangement_notes", "band thins at 1:20"],
    ["arrangement_notes", [3]],
    ["ending_detail", "cold"],
    ["ending_detail", { type: "silence", stop_at: 10, silent_from: 10, mmss: "0:10" }],
  ])("rejects a malformed %s", (field, value) => {
    expect(isMeasuredSong({ ...extended, [field]: value })).toBe(false);
  });

  it("rejects a payload missing the base fields", () => {
    expect(isMeasuredSong({ sections: [] })).toBe(false);
    expect(isMeasuredSong(null)).toBe(false);
  });
});
