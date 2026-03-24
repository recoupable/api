import type { ArtistIntelPack } from "@/lib/artistIntel/generateArtistIntelPack";

/**
 * Renders a 10-character ASCII progress bar for a 0–100 score.
 *
 * @param score - A numeric score from 0 to 100.
 * @returns A 10-character bar using block/light characters.
 */
function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/**
 * Returns an emoji that represents the qualitative opportunity rating.
 *
 * @param rating - One of: "exceptional", "strong", "moderate", "weak".
 * @returns An emoji character for inline display.
 */
function ratingEmoji(rating: string): string {
  switch (rating) {
    case "exceptional":
      return "🔥";
    case "strong":
      return "✅";
    case "moderate":
      return "⚡";
    default:
      return "○";
  }
}

/**
 * Formats an Artist Intelligence Pack as a rich markdown document.
 *
 * Sections:
 * 1. Artist Profile (Spotify stats)
 * 2. Opportunity Scores Dashboard (algorithmically computed — new)
 * 3. Peer Benchmarking (real Spotify data for related artists — new)
 * 4. Catalog Analysis (hit-driven vs. consistent — new)
 * 5. Music DNA (MusicFlamingo AI)
 * 6. Recent News & Press (Perplexity)
 * 7. Industry Pack (AI copy grounded in real data)
 * 8. Outreach & Social
 *
 * @param pack - The complete artist intelligence pack.
 * @returns A formatted markdown string ready to display in chat or export.
 */
export function formatArtistIntelPackAsMarkdown(pack: ArtistIntelPack): string {
  const {
    artist,
    top_track,
    music_analysis,
    web_context,
    peer_benchmark,
    opportunity_scores,
    catalog_depth,
    marketing_pack,
    elapsed_seconds,
  } = pack;

  const lines: string[] = [];

  lines.push(`# Artist Intelligence Pack: ${artist.name}`);
  lines.push(``);
  lines.push(
    `> Generated in ${elapsed_seconds}s · Spotify + MusicFlamingo AI + Perplexity + Peer Intelligence`,
  );
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── 1. Artist Profile ────────────────────────────────────────────────────────
  lines.push(`## Artist Profile`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Followers | ${artist.followers.toLocaleString()} |`);
  lines.push(`| Spotify Popularity | ${artist.popularity}/100 |`);
  if (artist.genres.length > 0) {
    lines.push(`| Genres | ${artist.genres.slice(0, 4).join(", ")} |`);
  }
  if (top_track) {
    lines.push(`| Top Track | "${top_track.name}" — *${top_track.album_name}* |`);
    lines.push(`| Track Popularity | ${top_track.popularity}/100 |`);
    if (top_track.preview_url) {
      lines.push(`| Preview | ${top_track.preview_url} |`);
    }
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── 2. Opportunity Scores Dashboard ─────────────────────────────────────────
  lines.push(`## Opportunity Scores`);
  lines.push(``);
  lines.push(
    `> Algorithmically computed from real audio data and Spotify metrics — not AI-generated text.`,
  );
  lines.push(``);
  lines.push(`**Overall Score: ${opportunity_scores.overall}/100**`);
  lines.push(``);
  lines.push(`| Category | Score | Rating | Signal |`);
  lines.push(`|----------|-------|--------|--------|`);
  lines.push(
    `| 🎬 Sync & Licensing | ${opportunity_scores.sync.score}/100 | ${ratingEmoji(opportunity_scores.sync.rating)} ${opportunity_scores.sync.rating} | ${scoreBar(opportunity_scores.sync.score)} |`,
  );
  lines.push(
    `| 🎵 Playlist Placement | ${opportunity_scores.playlist.score}/100 | ${ratingEmoji(opportunity_scores.playlist.rating)} ${opportunity_scores.playlist.rating} | ${scoreBar(opportunity_scores.playlist.score)} |`,
  );
  lines.push(
    `| 🎤 A&R Priority | ${opportunity_scores.ar.score}/100 | ${ratingEmoji(opportunity_scores.ar.rating)} ${opportunity_scores.ar.rating} | ${scoreBar(opportunity_scores.ar.score)} |`,
  );
  lines.push(
    `| 🤝 Brand Partnership | ${opportunity_scores.brand.score}/100 | ${ratingEmoji(opportunity_scores.brand.rating)} ${opportunity_scores.brand.rating} | ${scoreBar(opportunity_scores.brand.score)} |`,
  );
  lines.push(``);

  lines.push(`**What's driving these scores:**`);
  lines.push(``);
  lines.push(`- **Sync:** ${opportunity_scores.sync.rationale}`);
  lines.push(`- **Playlist:** ${opportunity_scores.playlist.rationale}`);
  lines.push(`- **A&R:** ${opportunity_scores.ar.rationale}`);
  lines.push(`- **Brand:** ${opportunity_scores.brand.rationale}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── 3. Peer Benchmarking ─────────────────────────────────────────────────────
  if (peer_benchmark && peer_benchmark.peers.length > 0) {
    lines.push(`## Peer Benchmarking`);
    lines.push(``);
    lines.push(
      `> Real Spotify data for related artists — actual follower counts, not AI estimates.`,
    );
    lines.push(``);
    lines.push(
      `**${artist.name}** ranks at the **${peer_benchmark.follower_percentile}th percentile** for followers and **${peer_benchmark.popularity_percentile}th percentile** for popularity among their peer set.`,
    );
    lines.push(``);

    lines.push(`| Artist | Followers | Popularity |`);
    lines.push(`|--------|-----------|------------|`);
    // Insert target artist in the table for easy comparison
    lines.push(
      `| **${artist.name} ← YOU** | **${artist.followers.toLocaleString()}** | **${artist.popularity}/100** |`,
    );
    for (const peer of peer_benchmark.peers) {
      const gap = peer.followers - artist.followers;
      const gapStr = gap > 0 ? `+${(gap / 1000).toFixed(0)}K` : `${(gap / 1000).toFixed(0)}K`;
      lines.push(
        `| ${peer.name} | ${peer.followers.toLocaleString()} (${gapStr}) | ${peer.popularity}/100 |`,
      );
    }
    lines.push(``);

    lines.push(
      `**Peer medians:** ${peer_benchmark.median_followers.toLocaleString()} followers · ${peer_benchmark.median_popularity}/100 popularity`,
    );
    if (peer_benchmark.top_peer) {
      const gapToTop = peer_benchmark.top_peer.followers - artist.followers;
      if (gapToTop > 0) {
        lines.push(
          `**Growth ceiling:** ${peer_benchmark.top_peer.name} is the top peer at ${peer_benchmark.top_peer.followers.toLocaleString()} followers — ${(gapToTop / 1000).toFixed(0)}K gap to close.`,
        );
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  // ── 4. Catalog Analysis ──────────────────────────────────────────────────────
  if (catalog_depth) {
    lines.push(`## Catalog Analysis`);
    lines.push(``);

    lines.push(`**${catalog_depth.catalog_type_label}**`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Tracks Analysed | ${catalog_depth.track_count} |`);
    lines.push(`| Avg Track Popularity | ${catalog_depth.avg_popularity}/100 |`);
    lines.push(`| Consistency Score | ${catalog_depth.consistency_score}/100 |`);
    lines.push(
      `| Top Track Concentration | ${catalog_depth.top_track_concentration_pct}% of total popularity |`,
    );
    lines.push(``);

    lines.push(`**Track Popularity Ranking:**`);
    lines.push(``);
    for (const track of catalog_depth.ranked_tracks) {
      const bar = scoreBar(track.popularity);
      lines.push(`- "${track.name}" ${bar} ${track.popularity}/100`);
    }
    lines.push(``);

    if (catalog_depth.catalog_type === "hit_driven") {
      lines.push(
        `> ⚡ **Hit-Driven Catalog:** The top track drives a disproportionate share of streams. A&R and sync pitches should lead with that single while building catalog breadth.`,
      );
    } else if (catalog_depth.catalog_type === "consistent") {
      lines.push(
        `> ✅ **Consistent Catalog:** Multiple tracks perform at similar levels — ideal for playlist placement campaigns and licensing packages.`,
      );
    } else {
      lines.push(
        `> 🌱 **Emerging Catalog:** Still building traction. Focus on breaking the first standout track before broader pitching.`,
      );
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  // ── 5. Music DNA ─────────────────────────────────────────────────────────────
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

  // ── 6. Web Context ───────────────────────────────────────────────────────────
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

  // ── 7. Industry Pack ─────────────────────────────────────────────────────────
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

  // ── 8. Outreach & Social ─────────────────────────────────────────────────────
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
