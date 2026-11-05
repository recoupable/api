import { describe, it, expect } from "vitest";
import { songMomentsBodySchema } from "../songMomentsBodySchema";

describe("songMomentsBodySchema", () => {
  it("describes every moment by default", () => {
    const parsed = songMomentsBodySchema.parse({ audio_url: "https://example.com/song.mp3" });
    expect(parsed.describe).toBe(true);
    expect(parsed.section_order).toBeUndefined();
    expect(parsed.tempo_hint).toBeUndefined();
  });

  it("accepts a lyric sheet's section order and a list of moments to describe", () => {
    const parsed = songMomentsBodySchema.parse({
      audio_url: "https://example.com/song.mp3",
      section_order: ["Verse 1", "Chorus", "Verse 2", "Chorus"],
      describe: ["vocal_hook", "climax"],
    });
    expect(parsed.describe).toEqual(["vocal_hook", "climax"]);
  });

  it("requires audio_url", () => {
    const result = songMomentsBodySchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("audio_url is required");
  });

  it("rejects an unknown moment type", () => {
    const result = songMomentsBodySchema.safeParse({
      audio_url: "https://example.com/song.mp3",
      describe: ["drop_the_bass"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a tempo hint between 30 and 300 BPM", () => {
    const parsed = songMomentsBodySchema.parse({
      audio_url: "https://example.com/song.mp3",
      tempo_hint: 86,
    });
    expect(parsed.tempo_hint).toBe(86);
  });

  it.each([29, 301, "86"])("rejects a tempo hint of %j", tempo_hint => {
    const result = songMomentsBodySchema.safeParse({
      audio_url: "https://example.com/song.mp3",
      tempo_hint,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["tempo_hint"]);
  });

  it("rejects more than 60 section labels", () => {
    const result = songMomentsBodySchema.safeParse({
      audio_url: "https://example.com/song.mp3",
      section_order: Array.from({ length: 61 }, () => "Verse"),
    });
    expect(result.success).toBe(false);
  });
});
