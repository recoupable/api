import { describe, it, expect } from "vitest";
import { formatArtistIntelPackAsMarkdown } from "@/lib/artistIntel/formatArtistIntelPackAsMarkdown";
import type { ArtistIntelPack } from "@/lib/artistIntel/generateArtistIntelPack";

const basePack: ArtistIntelPack = {
  artist: {
    name: "Test Artist",
    spotify_id: "spotify-123",
    genres: ["pop", "indie pop"],
    followers: 1_500_000,
    popularity: 78,
    image_url: "https://example.com/image.jpg",
  },
  top_track: {
    name: "Biggest Hit",
    spotify_id: "track-456",
    preview_url: "https://p.scdn.co/preview.mp3",
    album_name: "Great Album",
    popularity: 85,
  },
  music_analysis: {
    catalog_metadata: {
      genre: "pop",
      subgenres: ["indie pop", "bedroom pop"],
      mood: ["dreamy", "melancholic"],
      tempo_bpm: 120,
      key: "C major",
      time_signature: "4/4",
      instruments: ["guitar", "synth", "drums"],
      vocal_type: "female",
      vocal_style: "breathy, conversational",
      production_style: "bedroom pop",
      energy_level: 6,
      danceability: 7,
      lyrical_themes: ["love", "nostalgia"],
      similar_artists: ["Clairo", "Soccer Mommy"],
      description: "A dreamy indie pop track with lush production.",
    },
    audience_profile: {
      age_range: "18-28",
      gender_skew: "female-leaning",
      lifestyle_tags: ["journal-keeper", "coffee shop regular"],
      listening_contexts: ["late-night alone", "rainy day studying", "road trips"],
      platforms: ["Spotify", "TikTok", "Apple Music"],
      playlist_types: ["indie chill", "bedroom pop essentials"],
      comparable_fanbases: ["Clairo fans", "Lorde fans"],
      marketing_hook: "For the dreamers who feel everything too deeply.",
    },
    playlist_pitch:
      "SONG SUMMARY: A dreamy indie pop track.\n\nWHY IT FITS: Perfect for late-night playlists.",
    mood_tags: {
      tags: ["dreamy", "late-night", "heartbreak", "chill"],
      primary_mood: "melancholic",
    },
  },
  web_context: {
    summary:
      "Test Artist is a rising indie pop singer-songwriter who released their debut album in 2024 to critical acclaim.",
    citations: ["https://pitchfork.com/test", "https://nme.com/test"],
  },
  marketing_pack: {
    playlist_pitch_email:
      "Dear Curator,\n\nTest Artist is perfect for your playlist.\n\nBest,\nThe Team",
    instagram_caption: "New music from Test Artist is here 🎵 #indiepop #newmusic",
    tiktok_caption: "You need to hear Test Artist 🔥 #viral #indiepop",
    twitter_post: "New music alert: Test Artist just dropped something special 🎵",
    press_release_opener:
      "Test Artist releases their highly anticipated debut. With 1.5M Spotify followers, they deliver a standout offering.",
    key_talking_points: [
      "1.5M Spotify followers",
      "78/100 popularity score",
      "Rising indie pop artist",
    ],
  },
  formatted_report: "",
  elapsed_seconds: 28.5,
};

describe("formatArtistIntelPackAsMarkdown", () => {
  it("includes the artist name in the heading", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("# Artist Intelligence Pack: Test Artist");
  });

  it("includes elapsed time in the header", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("28.5s");
  });

  it("includes follower count and popularity", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("1,500,000");
    expect(result).toContain("78/100");
  });

  it("includes genre information", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("pop");
    expect(result).toContain("indie pop");
  });

  it("includes top track name and album", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("Biggest Hit");
    expect(result).toContain("Great Album");
  });

  it("includes music DNA section when analysis is available", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("## Music DNA");
    expect(result).toContain("**BPM:** 120");
    expect(result).toContain("C major");
    expect(result).toContain("6/10");
  });

  it("includes audience profile", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("18-28");
    expect(result).toContain("female-leaning");
    expect(result).toContain("For the dreamers who feel everything too deeply.");
  });

  it("includes mood tags", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("dreamy");
    expect(result).toContain("melancholic");
  });

  it("includes web context and citations", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("## Recent Web Context");
    expect(result).toContain("rising indie pop singer-songwriter");
    expect(result).toContain("pitchfork.com");
  });

  it("includes marketing pack sections", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("### Playlist Pitch Email");
    expect(result).toContain("### Social Media Captions");
    expect(result).toContain("**Instagram:**");
    expect(result).toContain("**TikTok:**");
    expect(result).toContain("**Twitter/X:**");
    expect(result).toContain("### Press Release Opener");
    expect(result).toContain("### Key Talking Points");
  });

  it("includes key talking points as bullet list", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("- 1.5M Spotify followers");
    expect(result).toContain("- 78/100 popularity score");
  });

  it("omits music DNA section when analysis is null", () => {
    const pack = { ...basePack, music_analysis: null };
    const result = formatArtistIntelPackAsMarkdown(pack);
    expect(result).not.toContain("## Music DNA");
  });

  it("omits web context section when web_context is null", () => {
    const pack = { ...basePack, web_context: null };
    const result = formatArtistIntelPackAsMarkdown(pack);
    expect(result).not.toContain("## Recent Web Context");
  });

  it("handles missing top track gracefully", () => {
    const pack = { ...basePack, top_track: null };
    const result = formatArtistIntelPackAsMarkdown(pack);
    expect(result).toContain("# Artist Intelligence Pack");
    expect(result).not.toContain("Biggest Hit");
  });

  it("omits citations line when citations array is empty", () => {
    const pack = { ...basePack, web_context: { summary: "Some context", citations: [] } };
    const result = formatArtistIntelPackAsMarkdown(pack);
    expect(result).toContain("Some context");
    expect(result).not.toContain("*Sources:");
  });
});
