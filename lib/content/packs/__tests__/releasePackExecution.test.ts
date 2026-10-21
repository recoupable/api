import { describe, expect, it } from "vitest";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackDeliverablesSchema } from "../releasePackSchema";
import { buildPackAssetPrompt } from "../buildPackAssetPrompt";
import { releasePackBriefSchema } from "../releasePackSchema";
import { getPackBriefFingerprint } from "../getPackBriefFingerprint";

describe("release pack production contract", () => {
  const brief = releasePackBriefSchema.parse({
    artist_name: "Grace",
    song_title: "I Wish",
    audio_url: "https://music.example.com/song.mp3",
    occasion: "anniversary",
    original_release_date: "2016-10-20",
    campaign_date: "2026-10-20",
    creative_direction: "blue paper collage",
    constraints: ["no invented face"],
  });
  it("quotes all fifteen creative pieces and counts carousel slides separately", () => {
    const quote = buildReleasePackQuote(brief, releasePackDeliverablesSchema.parse({}));
    expect(quote.assets).toHaveLength(15);
    expect(quote.creative_piece_count).toBe(15);
    expect(quote.generated_file_count).toBe(18);
    expect(quote.line_items.map(item => item.category)).toEqual(
      expect.arrayContaining(["stills", "motion", "captions", "inspection", "composition"]),
    );
    expect(quote.maximum_usd).toBeCloseTo(quote.assets.reduce((sum, a) => sum + a.maximum_usd, 0));
  });
  it("allows a one-piece proof without accidentally quoting a full pack", () => {
    const q = buildReleasePackQuote(
      brief,
      releasePackDeliverablesSchema.parse({
        videos: 0,
        quote_cards: 0,
        artwork: 1,
        carousels: 0,
        visualizers: 0,
      }),
    );
    expect(q.assets).toHaveLength(1);
    expect(q.assets[0].kind).toBe("artwork");
  });
  it("passes music identity, occasion, dates and constraints into actual creative prompts", () => {
    const prompt = buildPackAssetPrompt(brief, "video", 2);
    for (const value of [
      "Grace",
      "I Wish",
      "anniversary",
      "2016-10-20",
      "2026-10-20",
      "blue paper collage",
      "no invented face",
    ])
      expect(prompt).toContain(value);
    expect(prompt).toContain("Never invent");
  });
  it("binds quote to deliverables as well as the brief", () => {
    const a = buildReleasePackQuote(brief, releasePackDeliverablesSchema.parse({}));
    const b = buildReleasePackQuote(
      brief,
      releasePackDeliverablesSchema.parse({ video_seconds: 5 }),
    );
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(a.brief_fingerprint).toBe(getPackBriefFingerprint(brief));
  });
});
