import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateArtistIntelPack } from "@/lib/artistIntel/generateArtistIntelPack";

import { getArtistSpotifyData } from "@/lib/artistIntel/getArtistSpotifyData";
import { getArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import { getArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";
import { buildArtistMarketingCopy } from "@/lib/artistIntel/buildArtistMarketingCopy";

vi.mock("@/lib/artistIntel/getArtistSpotifyData", () => ({
  getArtistSpotifyData: vi.fn(),
}));
vi.mock("@/lib/artistIntel/getArtistMusicAnalysis", () => ({
  getArtistMusicAnalysis: vi.fn(),
}));
vi.mock("@/lib/artistIntel/getArtistWebContext", () => ({
  getArtistWebContext: vi.fn(),
}));
vi.mock("@/lib/artistIntel/buildArtistMarketingCopy", () => ({
  buildArtistMarketingCopy: vi.fn(),
}));

const mockSpotifyData = {
  artist: {
    id: "spotify-123",
    name: "Test Artist",
    genres: ["pop", "indie"],
    followers: { total: 1_000_000 },
    popularity: 75,
    images: [{ url: "https://example.com/image.jpg", height: 640, width: 640 }],
  },
  topTracks: [
    {
      id: "track-123",
      name: "Top Hit",
      preview_url: "https://p.scdn.co/preview.mp3",
      popularity: 80,
      album: { name: "Great Album", images: [] },
    },
  ],
  previewUrl: "https://p.scdn.co/preview.mp3",
};

const mockMusicAnalysis = {
  catalog_metadata: { genre: "pop", bpm: 120 },
  audience_profile: { age_range: "18-34" },
  playlist_pitch: { playlists: ["Today's Top Hits"] },
  mood_tags: { moods: ["energetic", "uplifting"] },
};

const mockWebContext = {
  results: [{ title: "Test", url: "https://example.com", snippet: "Artist news" }],
  summary: "Artist news summary",
};

const mockMarketingCopy = {
  playlist_pitch_email: "Dear curator...",
  instagram_caption: "New music out now! #pop",
  tiktok_caption: "You need to hear this! #music",
  twitter_post: "New drop! 🎵",
  press_release_opener: "Test Artist releases their latest work...",
  key_talking_points: ["1M Spotify followers", "Rising indie-pop artist"],
};

describe("generateArtistIntelPack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns a complete intelligence pack when all services succeed", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(mockMusicAnalysis);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type !== "success") return;

      expect(result.pack.artist.name).toBe("Test Artist");
      expect(result.pack.artist.spotify_id).toBe("spotify-123");
      expect(result.pack.artist.followers).toBe(1_000_000);
      expect(result.pack.artist.genres).toEqual(["pop", "indie"]);
      expect(result.pack.artist.popularity).toBe(75);
      expect(result.pack.artist.image_url).toBe("https://example.com/image.jpg");
    });

    it("returns top track data correctly", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(mockMusicAnalysis);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type !== "success") return;

      expect(result.pack.top_track?.name).toBe("Top Hit");
      expect(result.pack.top_track?.preview_url).toBe("https://p.scdn.co/preview.mp3");
      expect(result.pack.top_track?.album_name).toBe("Great Album");
    });

    it("returns music analysis and web context", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(mockMusicAnalysis);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type !== "success") return;

      expect(result.pack.music_analysis).toEqual(mockMusicAnalysis);
      expect(result.pack.web_context).toEqual(mockWebContext);
      expect(result.pack.marketing_pack).toEqual(mockMarketingCopy);
    });

    it("calls music analysis with the preview URL", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(mockMusicAnalysis);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      await generateArtistIntelPack("Test Artist");

      expect(getArtistMusicAnalysis).toHaveBeenCalledWith("https://p.scdn.co/preview.mp3");
      expect(getArtistWebContext).toHaveBeenCalledWith("Test Artist");
    });

    it("skips music analysis when no preview URL is available", async () => {
      const noPreviewData = { ...mockSpotifyData, previewUrl: null };
      vi.mocked(getArtistSpotifyData).mockResolvedValue(noPreviewData);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      expect(getArtistMusicAnalysis).not.toHaveBeenCalled();
      if (result.type === "success") {
        expect(result.pack.music_analysis).toBeNull();
      }
    });

    it("succeeds even when music analysis returns null", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(null);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.pack.music_analysis).toBeNull();
      }
    });

    it("succeeds even when web context returns null", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(mockMusicAnalysis);
      vi.mocked(getArtistWebContext).mockResolvedValue(null);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.pack.web_context).toBeNull();
      }
    });

    it("returns elapsed_seconds in the pack", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(mockSpotifyData);
      vi.mocked(getArtistMusicAnalysis).mockResolvedValue(mockMusicAnalysis);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(typeof result.pack.elapsed_seconds).toBe("number");
        expect(result.pack.elapsed_seconds).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns null top_track when artist has no tracks", async () => {
      const noTracksData = { ...mockSpotifyData, topTracks: [], previewUrl: null };
      vi.mocked(getArtistSpotifyData).mockResolvedValue(noTracksData);
      vi.mocked(getArtistWebContext).mockResolvedValue(mockWebContext);
      vi.mocked(buildArtistMarketingCopy).mockResolvedValue(mockMarketingCopy);

      const result = await generateArtistIntelPack("Test Artist");

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.pack.top_track).toBeNull();
      }
    });
  });

  describe("error cases", () => {
    it("returns error when artist not found on Spotify", async () => {
      vi.mocked(getArtistSpotifyData).mockResolvedValue(null);

      const result = await generateArtistIntelPack("Totally Unknown Artist XYZ999");

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.error).toContain("Totally Unknown Artist XYZ999");
      }
    });
  });
});
