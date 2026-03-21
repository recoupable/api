import type { ArtistIntelPack } from "@/lib/artistIntel/generateArtistIntelPack";

/**
 * Formats an Artist Intelligence Pack as a rich markdown document.
 *
 * Produces a human-readable report with sections for artist profile,
 * music DNA (MusicFlamingo AI analysis), web context (Perplexity), and
 * the full industry pack (one-sheet, A&R memo, sync brief, playlist targets,
 * brand partnership pitch, social copy).
 *
 * @param pack - The complete artist intelligence pack.
 * @returns A formatted markdown string ready to display in chat or export.
 */
export function formatArtistIntelPackAsMarkdown(pack: ArtistIntelPack): string {
  const { artist, top_track, music_analysis, web_context, marketing_pack, elapsed_seconds } = pack;

  const lines: string[] = [];

  lines.push(`# Artist Intelligence Pack: ${artist.name}`);
  lines.push(``);
  lines.push(`> Generated in ${elapsed_seconds}s · Spotify + MusicFlamingo AI + Perplexity`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Artist profile
  lines.push(`## Artist Profile`);
  lines.push(``);
  lines.push(`- **Followers:** ${artist.followers.toLocaleString()}`);
  lines.push(`- **Popularity:** ${artist.popularity}/100`);
  if (artist.genres.length > 0) {
    lines.push(`- **Genres:** ${artist.genres.slice(0, 4).join(", ")}`);
  }
  if (top_track) {
    lines.push(
      `- **Top Track:** "${top_track.name}" — *${top_track.album_name}* (popularity: ${top_track.popularity}/100)`,
    );
    if (top_track.preview_url) {
      lines.push(`- **Preview:** ${top_track.preview_url}`);
    }
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Music DNA
  if (music_analysis) {
    lines.push(`## Music DNA (NVIDIA MusicFlamingo AI)`);
    lines.push(``);

    const meta = music_analysis.catalog_metadata;
    if (meta) {
      const genreLine = meta.subgenres?.length
        ? `**Genre:** ${meta.genre} *(${meta.subgenres.join(", ")})*`
        : `**Genre:** ${meta.genre}`;
      lines.push(genreLine);
      lines.push(
        `**BPM:** ${meta.tempo_bpm} | **Key:** ${meta.key} | **Time:** ${meta.time_signature}`,
      );
      lines.push(`**Energy:** ${meta.energy_level}/10 | **Danceability:** ${meta.danceability}/10`);
      if (meta.mood?.length) lines.push(`**Mood:** ${meta.mood.join(", ")}`);
      if (meta.instruments?.length) lines.push(`**Instruments:** ${meta.instruments.join(", ")}`);
      if (meta.vocal_style) lines.push(`**Vocal Style:** ${meta.vocal_style}`);
      if (meta.production_style) lines.push(`**Production:** ${meta.production_style}`);
      if (meta.similar_artists?.length)
        lines.push(`**Sounds Like:** ${meta.similar_artists.join(", ")}`);
      if (meta.description) lines.push(`**Description:** ${meta.description}`);
      lines.push(``);
    }

    const audience = music_analysis.audience_profile;
    if (audience) {
      lines.push(
        `**Target Audience:** ${audience.age_range}${audience.gender_skew !== "neutral" ? `, ${audience.gender_skew}` : ""}`,
      );
      if (audience.listening_contexts?.length) {
        lines.push(
          `**Listening Contexts:** ${audience.listening_contexts.slice(0, 3).join(" · ")}`,
        );
      }
      if (audience.platforms?.length) {
        lines.push(`**Key Platforms:** ${audience.platforms.join(", ")}`);
      }
      if (audience.comparable_fanbases?.length) {
        lines.push(`**Comparable Fanbases:** ${audience.comparable_fanbases.join(", ")}`);
      }
      if (audience.marketing_hook) {
        lines.push(`**Marketing Hook:** *"${audience.marketing_hook}"*`);
      }
      lines.push(``);
    }

    const moods = music_analysis.mood_tags;
    if (moods?.tags?.length) {
      lines.push(`**Vibe Tags:** ${moods.tags.join(" · ")}`);
      if (moods.primary_mood) lines.push(`**Primary Mood:** ${moods.primary_mood}`);
      lines.push(``);
    }

    if (music_analysis.playlist_pitch) {
      lines.push(`**Playlist Pitch (AI-generated from audio):**`);
      lines.push(``);
      lines.push(music_analysis.playlist_pitch);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);
  }

  // Web context
  if (web_context?.summary) {
    lines.push(`## Recent News & Press`);
    lines.push(``);
    lines.push(web_context.summary);
    lines.push(``);
    if (web_context.citations?.length) {
      lines.push(`*Sources: ${web_context.citations.slice(0, 3).join(", ")}*`);
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
  }

  // Industry Pack — highest-value outputs for artists & labels
  lines.push(`## Industry Pack`);
  lines.push(``);

  if (marketing_pack.artist_one_sheet) {
    lines.push(`### Artist One-Sheet`);
    lines.push(``);
    lines.push(marketing_pack.artist_one_sheet);
    lines.push(``);
  }

  if (marketing_pack.ar_memo) {
    lines.push(`### A&R Memo`);
    lines.push(``);
    lines.push(marketing_pack.ar_memo);
    lines.push(``);
  }

  if (marketing_pack.sync_brief) {
    lines.push(`### Sync & Licensing Brief`);
    lines.push(``);
    lines.push(marketing_pack.sync_brief);
    lines.push(``);
  }

  if (marketing_pack.spotify_playlist_targets?.length) {
    lines.push(`### Spotify Editorial Playlist Targets`);
    lines.push(``);
    for (const playlist of marketing_pack.spotify_playlist_targets) {
      lines.push(`- ${playlist}`);
    }
    lines.push(``);
  }

  if (marketing_pack.brand_partnership_pitch) {
    lines.push(`### Brand Partnership Pitch`);
    lines.push(``);
    lines.push(marketing_pack.brand_partnership_pitch);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  // Outreach & Social (secondary section)
  lines.push(`## Outreach & Social`);
  lines.push(``);

  lines.push(`### Playlist Pitch Email`);
  lines.push(``);
  lines.push(marketing_pack.playlist_pitch_email);
  lines.push(``);

  lines.push(`### Press Release Opener`);
  lines.push(``);
  lines.push(marketing_pack.press_release_opener);
  lines.push(``);

  if (marketing_pack.key_talking_points?.length) {
    lines.push(`### Key Talking Points`);
    lines.push(``);
    for (const point of marketing_pack.key_talking_points) {
      lines.push(`- ${point}`);
    }
    lines.push(``);
  }

  lines.push(`### Social Media Captions`);
  lines.push(``);
  lines.push(`**Instagram:** ${marketing_pack.instagram_caption}`);
  lines.push(``);
  lines.push(`**TikTok:** ${marketing_pack.tiktok_caption}`);
  lines.push(``);
  lines.push(`**Twitter/X:** ${marketing_pack.twitter_post}`);
  lines.push(``);

  return lines.join("\n").trim();
}
