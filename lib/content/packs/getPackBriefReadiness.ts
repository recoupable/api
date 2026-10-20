import type { ReleasePackBrief } from "./releasePackSchema";

/** Collect only missing creative inputs; roster setup and research are never gates. */
export function getPackBriefReadiness(brief: ReleasePackBrief) {
  const missing: string[] = [];
  if (!brief.artist_name) missing.push("artist_name");
  if (!brief.song_title) missing.push("song_title");
  if (!brief.audio_url) missing.push("audio_url");
  if (!brief.occasion) missing.push("occasion");
  if (
    !brief.creative_direction &&
    !brief.reference_image_urls.length &&
    !brief.allow_creative_defaults
  )
    missing.push("creative_direction");
  if (brief.occasion === "anniversary" && !brief.original_release_date)
    missing.push("original_release_date");

  const assumptions = [
    `Primary action: ${brief.primary_action}.`,
    `Formats for ${brief.platforms.join(" and ")}.`,
  ];
  if (brief.allow_creative_defaults && !brief.creative_direction)
    assumptions.push(
      "Propose a creative direction from the supplied music and artwork; this is not established artist branding.",
    );
  if (!brief.audience)
    assumptions.push("Audience fit is a creative proposal; no demographic or performance claims.");
  if (!brief.destination_url)
    assumptions.push("No destination link supplied; captions must not invent one.");

  const labels: Record<string, string> = {
    artist_name: "artist name",
    song_title: "song title",
    audio_url: "usable song audio",
    occasion: "campaign occasion",
    creative_direction: "artwork, a creative reference, or permission to propose a direction",
    original_release_date: "original release date for the anniversary",
  };
  return {
    ready: missing.length === 0,
    missing,
    assumptions,
    next_action: missing.length
      ? `Keep making this pack. Ask once for: ${missing.map(key => labels[key]).join("; ")}.`
      : "Show the creative direction and complete quote, then request spending approval.",
  };
}
