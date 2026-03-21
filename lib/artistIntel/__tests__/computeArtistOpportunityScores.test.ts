import { describe, it, expect } from "vitest";
import { computeArtistOpportunityScores } from "@/lib/artistIntel/computeArtistOpportunityScores";

describe("computeArtistOpportunityScores", () => {
  describe("pre-market artist (very low followers + low popularity)", () => {
    it("detects a pre-market artist like Gatsby Grace (2 followers, 0 popularity)", () => {
      const scores = computeArtistOpportunityScores(
        null, // no music analysis (no preview URL)
        2, // followers — real Gatsby Grace Spotify data
        0, // popularity — real Gatsby Grace Spotify data
        null, // no peer benchmark (Spotify has no related artists for pre-market acts)
      );

      // All scores should be in the weak-to-moderate range — early stage, not established
      expect(scores.sync.score).toBe(30); // 30 + 0*0.4 = 30
      expect(scores.sync.rating).toBe("weak");
      expect(scores.sync.rationale).toContain("Audio analysis unavailable");

      expect(scores.playlist.score).toBe(35); // 35 + 0*0.5 = 35
      expect(scores.playlist.rating).toBe("weak");

      // A&R rationale should say "pre-market" — NOT "established/saturated"
      expect(scores.ar.rationale).toContain("Pre-market artist");
      expect(scores.ar.rationale).not.toContain("established");
      expect(scores.ar.rationale).not.toContain("saturated");
      expect(scores.ar.score).toBeGreaterThan(40); // gets a 10-pt early-discovery bonus

      expect(scores.brand.score).toBe(35); // 35 + 0*0.35 = 35
      expect(scores.brand.rating).toBe("weak");

      // Overall should reflect early-stage reality
      expect(scores.overall).toBeGreaterThan(0);
      expect(scores.overall).toBeLessThan(50);
    });

    it("uses growing/maturing rationale for artist with many followers but low popularity", () => {
      const scores = computeArtistOpportunityScores(
        null,
        5_000_000, // high followers
        5, // but very low popularity — not getting algorithm play
        null,
      );

      // Should NOT trigger pre-market — this is an established artist with low traction
      expect(scores.ar.rationale).not.toContain("Pre-market artist");
      expect(scores.ar.rationale).toContain("growing or maturing");
    });

    it("gives higher efficiency bonus when popularity is high relative to small audience", () => {
      // Artist with 500 followers but 60 popularity = punching way above weight
      const scores = computeArtistOpportunityScores(null, 500, 60, null);

      // followerEfficiency = 60 / log10(501) ≈ 60 / 2.7 ≈ 22.2 → "High" bonus (+25)
      expect(scores.ar.score).toBeGreaterThan(60);
      expect(scores.ar.rationale).toContain("High popularity-to-follower ratio");
    });
  });

  describe("with music analysis", () => {
    const fullMusicAnalysis = {
      catalog_metadata: {
        genre: "indie pop",
        subgenres: ["bedroom pop"],
        tempo_bpm: 110,
        key: "C major",
        time_signature: "4/4",
        energy_level: 6,
        danceability: 7,
        mood: ["uplifting", "nostalgic", "dreamy"],
        instruments: ["guitar", "piano", "synth", "drums"],
        vocal_style: "breathy",
        production_style: "polished, studio-quality",
        similar_artists: ["Clairo", "Phoebe Bridgers"],
        description: "Dreamy indie pop with bedroom vibes",
      },
      audience_profile: {
        age_range: "18-24",
        gender_skew: "female",
        lifestyle_tags: ["coffee shops", "college campus", "late nights", "aesthetics"],
        listening_contexts: ["studying", "commuting", "late night"],
        platforms: ["Spotify", "Apple Music", "TikTok"],
        comparable_fanbases: ["Clairo fans", "Phoebe Bridgers fans"],
        marketing_hook: "The soundtrack to your 3am thoughts",
      },
      playlist_pitch: "Perfect for late-night indie playlists and bedroom pop discovery",
      mood_tags: {
        tags: ["dreamy", "nostalgic", "cozy"],
        primary_mood: "contemplative",
      },
    };

    it("computes sync score from BPM and energy data", () => {
      const scores = computeArtistOpportunityScores(fullMusicAnalysis, 10_000, 45, null);

      // BPM 110 (in 70-130 range): +10
      // Energy 6 (in 3-8 range): +10
      // 3 moods: +8
      // polished production: +7
      // 4 instruments: +5
      // base: 50
      // total: 90 → capped at 100 → "exceptional"
      expect(scores.sync.score).toBeGreaterThan(60);
      expect(scores.sync.rationale).toContain("BPM");
    });

    it("computes playlist score from danceability", () => {
      const scores = computeArtistOpportunityScores(fullMusicAnalysis, 10_000, 45, null);

      // danceability 7: 7*5 = 35 points
      // energy 6: +5 for moderate
      // popularity 45 * 0.15 = +7
      // base: 40
      // total: 87 → "exceptional"
      expect(scores.playlist.score).toBeGreaterThan(70);
      expect(scores.playlist.rationale).toContain("Danceability");
    });
  });

  describe("overall score weighting", () => {
    it("computes overall as weighted average of four scores", () => {
      const scores = computeArtistOpportunityScores(null, 100_000, 50, null);

      // expected overall = Math.round(ar*0.3 + playlist*0.25 + sync*0.25 + brand*0.2)
      const expectedOverall = Math.round(
        scores.ar.score * 0.3 +
          scores.playlist.score * 0.25 +
          scores.sync.score * 0.25 +
          scores.brand.score * 0.2,
      );

      expect(scores.overall).toBe(expectedOverall);
    });
  });
});
