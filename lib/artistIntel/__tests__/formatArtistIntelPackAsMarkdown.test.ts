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
    artist_one_sheet:
      "Test Artist — indie pop artist with 1.5M Spotify followers.\n\nBio: Rising indie pop singer-songwriter from LA. Debut album 2024 to critical acclaim.\n\nKey Stats: 1.5M Spotify followers · 78/100 popularity · indie pop, bedroom pop\n\nFor Booking & Licensing: agent@recoupable.com",
    ar_memo:
      "ARTIST: Test Artist\nGENRE: indie pop\nCOMPS: Clairo (bedroom pop), Soccer Mommy (indie)\n\nMOMENTUM: 1.5M followers, 78/100 popularity. Debut album received critical acclaim.\n\nRECOMMENDATION: Development deal conversation. Strong sync and streaming upside.",
    sync_brief:
      "ARTIST: Test Artist\nTRACK: Biggest Hit\nMOOD: dreamy, melancholic, 120 BPM\n\nSync use cases:\n- Opening montage of a Netflix coming-of-age drama\n- Luxury skincare campaign targeting 20-35 year olds\n- Coffee shop lifestyle brand social content\n- End credits of an indie film\n\nContact: agent@recoupable.com",
    spotify_playlist_targets: [
      "New Music Friday",
      "Pollen",
      "bedroom pop",
      "Lorem",
      "Fresh Finds",
      "sad indie",
      "Late Night Feelings",
      "indie pop",
    ],
    brand_partnership_pitch:
      "Glossier — bedroom pop aesthetic and female-leaning demo matches their indie-cool beauty positioning. Activation: campaign soundtrack + artist feature.\n\nNike — dreamy indie pop for their mindfulness/yoga vertical. Activation: branded playlist curation.\n\nAesop — understated aesthetic and emotional depth aligns with their luxury positioning. Activation: in-store and digital ambient content.",
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
    expect(result).toContain("## Recent News & Press");
    expect(result).toContain("rising indie pop singer-songwriter");
    expect(result).toContain("pitchfork.com");
  });

  it("includes industry pack sections", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("## Industry Pack");
    expect(result).toContain("### Artist One-Sheet");
    expect(result).toContain("### A&R Memo");
    expect(result).toContain("### Sync & Licensing Brief");
    expect(result).toContain("### Spotify Editorial Playlist Targets");
    expect(result).toContain("### Brand Partnership Pitch");
  });

  it("includes artist one-sheet content", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("agent@recoupable.com");
    expect(result).toContain("1.5M Spotify followers");
  });

  it("includes A&R memo with comps", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("Clairo");
    expect(result).toContain("Development deal");
  });

  it("includes sync brief with use cases", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("Netflix");
    expect(result).toContain("Sync & Licensing Brief");
  });

  it("includes spotify playlist targets as bullet list", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("- New Music Friday");
    expect(result).toContain("- Pollen");
    expect(result).toContain("- bedroom pop");
  });

  it("includes brand partnership pitch", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("Glossier");
    expect(result).toContain("Brand Partnership Pitch");
  });

  it("includes outreach and social section", () => {
    const result = formatArtistIntelPackAsMarkdown(basePack);
    expect(result).toContain("## Outreach & Social");
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
    // The top track section line (with popularity) should not appear
    expect(result).not.toContain("*Great Album* (popularity:");
  });

  it("omits citations line when citations array is empty", () => {
    const pack = { ...basePack, web_context: { summary: "Some context", citations: [] } };
    const result = formatArtistIntelPackAsMarkdown(pack);
    expect(result).toContain("Some context");
    expect(result).not.toContain("*Sources:");
  });
});
