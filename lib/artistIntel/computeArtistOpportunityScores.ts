import type { ArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import type { PeerBenchmark } from "@/lib/artistIntel/getRelatedArtistsData";

export interface OpportunityScore {
  score: number; // 0–100
  rating: "weak" | "moderate" | "strong" | "exceptional";
  rationale: string;
}

export interface ArtistOpportunityScores {
  /** Sync licensing readiness — based on audio characteristics from MusicFlamingo */
  sync: OpportunityScore;
  /** Editorial playlist placement likelihood — based on energy, danceability, genre signals */
  playlist: OpportunityScore;
  /** A&R acquisition priority — based on trajectory, peer gap, and popularity-to-followers ratio */
  ar: OpportunityScore;
  /** Brand partnership potential — based on audience demographics and listening context */
  brand: OpportunityScore;
  /** Overall weighted opportunity score */
  overall: number;
}

/**
 * Maps a numeric score to a qualitative rating label.
 *
 * @param score - A numeric score from 0 to 100.
 * @returns A qualitative rating label.
 */
function rating(score: number): OpportunityScore["rating"] {
  if (score >= 80) return "exceptional";
  if (score >= 60) return "strong";
  if (score >= 40) return "moderate";
  return "weak";
}

/**
 * Computes four opportunity scores from real MusicFlamingo and Spotify data.
 * All scores are algorithmic — no AI inference, purely computed from observed metrics.
 *
 * @param musicAnalysis - MusicFlamingo audio analysis results.
 * @param followers - Artist's Spotify follower count.
 * @param popularity - Artist's Spotify popularity score (0–100).
 * @param peerBenchmark - Peer comparison data from Spotify related artists.
 * @returns Four domain-specific opportunity scores plus an overall score.
 */
export function computeArtistOpportunityScores(
  musicAnalysis: ArtistMusicAnalysis | null,
  followers: number,
  popularity: number,
  peerBenchmark: PeerBenchmark | null,
): ArtistOpportunityScores {
  // ── Sync Score ──────────────────────────────────────────────────────────────
  // High sync value = moderate energy (not too extreme), rich mood diversity,
  // clean/polished production, instrumental potential
  let syncScore = 50;
  const syncRationale: string[] = [];

  const meta = musicAnalysis?.catalog_metadata;
  if (meta) {
    // Moderate energy (60–75 BPM or energy 4–7) is most sync-placeable
    const bpm = meta.tempo_bpm ?? 0;
    if (bpm >= 70 && bpm <= 130) {
      syncScore += 10;
      syncRationale.push(`BPM ${bpm} is squarely in the sweet spot for sync placements`);
    } else if (bpm > 0) {
      syncScore -= 5;
      syncRationale.push(`BPM ${bpm} is outside typical sync range (70–130 BPM)`);
    }

    const energy = meta.energy_level ?? 0;
    if (energy >= 3 && energy <= 8) {
      syncScore += 10;
      syncRationale.push(`Energy level ${energy}/10 is versatile for TV/film placements`);
    }

    if (meta.mood && meta.mood.length >= 3) {
      syncScore += 8;
      syncRationale.push(
        `${meta.mood.length} distinct moods signals tonal versatility for editorial`,
      );
    }

    const cleanProduction = ["polished", "produced", "studio", "professional"].some(w =>
      meta.production_style?.toLowerCase().includes(w),
    );
    if (cleanProduction) {
      syncScore += 7;
      syncRationale.push("Polished production style meets broadcast quality standards");
    }

    if (meta.instruments && meta.instruments.length >= 4) {
      syncScore += 5;
      syncRationale.push(
        `Rich instrumentation (${meta.instruments.slice(0, 3).join(", ")}) opens multiple sync contexts`,
      );
    }
  } else {
    syncRationale.push("Audio analysis unavailable — score based on Spotify popularity proxy");
    syncScore = Math.round(30 + popularity * 0.4);
  }

  syncScore = Math.min(100, Math.max(0, syncScore));

  // ── Playlist Score ───────────────────────────────────────────────────────────
  // High playlist value = high danceability, strong energy, genre alignment with
  // editorial playlists, mood tags that match common playlist contexts
  let playlistScore = 40;
  const playlistRationale: string[] = [];

  if (meta) {
    const danceability = meta.danceability ?? 0;
    playlistScore += Math.round(danceability * 5); // 0–50 points
    if (danceability >= 7) {
      playlistRationale.push(
        `Danceability ${danceability}/10 is strong for workout and party playlists`,
      );
    } else if (danceability >= 5) {
      playlistRationale.push(`Danceability ${danceability}/10 fits lifestyle and mood playlists`);
    }

    const energy2 = meta.energy_level ?? 0;
    if (energy2 >= 7) {
      playlistScore += 10;
      playlistRationale.push(
        "High energy tracks perform well on New Music Friday and workout edits",
      );
    } else if (energy2 >= 4) {
      playlistScore += 5;
      playlistRationale.push("Moderate energy suits focus, chill, and indie discovery playlists");
    }

    // Popularity as a proxy for Spotify algorithm favour
    playlistScore += Math.round(popularity * 0.15);
    playlistRationale.push(`Spotify popularity ${popularity}/100 signals algorithmic momentum`);
  } else {
    playlistScore = Math.round(35 + popularity * 0.5);
    playlistRationale.push("Score computed from Spotify popularity in absence of audio analysis");
  }

  playlistScore = Math.min(100, Math.max(0, playlistScore));

  // ── A&R Score ────────────────────────────────────────────────────────────────
  // High A&R priority = artist punching above their weight (high popularity relative
  // to followers = algorithmic pull without mass following = acquisition opportunity),
  // meaningful gap below peer ceiling = upside potential
  let arScore = 40;
  const arRationale: string[] = [];

  // Popularity-to-followers efficiency: artists with high popularity but fewer followers
  // than their peers are "undervalued" — the classic A&R discovery signal
  const followerEfficiency = followers > 0 ? popularity / Math.log10(followers + 1) : 0;

  if (followerEfficiency > 12) {
    arScore += 25;
    arRationale.push(
      `High popularity-to-follower ratio (${followerEfficiency.toFixed(1)}) — strong algorithmic pull without mass audience`,
    );
  } else if (followerEfficiency > 8) {
    arScore += 15;
    arRationale.push(
      `Solid popularity-to-follower ratio (${followerEfficiency.toFixed(1)}) indicates organic traction`,
    );
  } else if (followers < 1000 && popularity < 10) {
    // Pre-market artist: very low followers AND very low popularity = early discovery opportunity
    arScore += 10;
    arRationale.push(
      `Pre-market artist (${followers} followers, ${popularity}/100 popularity) — no Spotify traction yet, highest early-discovery upside`,
    );
  } else {
    arRationale.push(
      `Popularity-to-follower ratio (${followerEfficiency.toFixed(1)}) suggests a growing or maturing audience positioning`,
    );
  }

  if (peerBenchmark) {
    const followerGap = peerBenchmark.top_peer ? peerBenchmark.top_peer.followers - followers : 0;

    if (followers < peerBenchmark.median_followers) {
      arScore += 20;
      arRationale.push(
        `${((peerBenchmark.median_followers - followers) / 1000).toFixed(0)}K below peer median — significant upside runway`,
      );
    } else {
      arRationale.push("At or above peer median — focus on next tier of growth");
    }

    if (followerGap > 0) {
      arRationale.push(
        `${(followerGap / 1000).toFixed(0)}K gap to top peer (${peerBenchmark.top_peer?.name}) shows potential ceiling`,
      );
    }

    arScore += Math.round(peerBenchmark.popularity_percentile * 0.15);
  } else {
    arScore += Math.round(popularity * 0.3);
    arRationale.push("Peer data unavailable — score based on raw popularity");
  }

  arScore = Math.min(100, Math.max(0, arScore));

  // ── Brand Score ──────────────────────────────────────────────────────────────
  // High brand value = specific demographic data, identifiable lifestyle tags,
  // multi-platform presence, clear marketing hook
  let brandScore = 40;
  const brandRationale: string[] = [];

  const audience = musicAnalysis?.audience_profile;
  if (audience) {
    if (audience.lifestyle_tags && audience.lifestyle_tags.length >= 3) {
      brandScore += 15;
      brandRationale.push(
        `${audience.lifestyle_tags.length} lifestyle tags (${audience.lifestyle_tags.slice(0, 2).join(", ")}) signal strong brand alignment surface area`,
      );
    }

    if (audience.platforms && audience.platforms.length >= 3) {
      brandScore += 10;
      brandRationale.push(
        `Multi-platform presence (${audience.platforms.join(", ")}) maximises brand campaign reach`,
      );
    }

    if (audience.marketing_hook) {
      brandScore += 10;
      brandRationale.push(`Clear marketing hook: "${audience.marketing_hook}"`);
    }

    // Specific age ranges are more valuable to brands than vague "18-35"
    const ageRange = audience.age_range ?? "";
    const isSpecificDemo = !ageRange.includes("18-35") && ageRange.length > 0;
    if (isSpecificDemo) {
      brandScore += 10;
      brandRationale.push(
        `Tight demographic (${ageRange}) is more valuable to brand media buyers than broad targeting`,
      );
    }

    if (audience.comparable_fanbases && audience.comparable_fanbases.length >= 2) {
      brandScore += 5;
      brandRationale.push(
        `Comparable fanbases (${audience.comparable_fanbases.slice(0, 2).join(", ")}) enable look-alike campaign targeting`,
      );
    }
  } else {
    brandScore = Math.round(35 + popularity * 0.35);
    brandRationale.push("Score based on Spotify popularity proxy (audience data unavailable)");
  }

  brandScore = Math.min(100, Math.max(0, brandScore));

  // ── Overall ──────────────────────────────────────────────────────────────────
  // Weighted: A&R (30%), Playlist (25%), Sync (25%), Brand (20%)
  const overall = Math.round(
    arScore * 0.3 + playlistScore * 0.25 + syncScore * 0.25 + brandScore * 0.2,
  );

  return {
    sync: {
      score: syncScore,
      rating: rating(syncScore),
      rationale: syncRationale.join(". ") || "Based on available audio metadata.",
    },
    playlist: {
      score: playlistScore,
      rating: rating(playlistScore),
      rationale: playlistRationale.join(". ") || "Based on available audio metadata.",
    },
    ar: {
      score: arScore,
      rating: rating(arScore),
      rationale: arRationale.join(". ") || "Based on Spotify metrics.",
    },
    brand: {
      score: brandScore,
      rating: rating(brandScore),
      rationale: brandRationale.join(". ") || "Based on available audience data.",
    },
    overall,
  };
}
