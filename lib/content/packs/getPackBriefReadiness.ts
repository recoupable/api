import type { ReleasePackBrief } from "./releasePackSchema";

/** Collect only missing creative inputs; roster setup and research are never gates. */
export function getPackBriefReadiness(brief: ReleasePackBrief) {
  const missing: string[] = [];
  if (!brief.artist_name) missing.push("artist_name");
  if (!brief.song_title) missing.push("song_title");
  if (!brief.audio_url) missing.push("audio_url");
  if (!brief.occasion) missing.push("occasion");
  const creative = brief.creative_context;
  const selected = creative?.directions.find(
    direction => direction.id === creative.selection?.direction_id,
  );
  const needsDirectionSelection =
    !!creative &&
    (!selected ||
      (creative.working_mode === "guided" && creative.selection?.selected_by !== "customer"));
  if (
    !creative &&
    !brief.creative_direction &&
    !brief.reference_image_urls.length &&
    !brief.allow_creative_defaults
  )
    missing.push("creative_direction");
  if (needsDirectionSelection) missing.push("creative_direction_selection");
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
  const inputGaps = missing.filter(key => key !== "creative_direction_selection");
  const directionAction = needsDirectionSelection
    ? creative?.working_mode === "guided"
      ? "Show the saved direction board options and retain this pack while the customer chooses or revises a direction. Do not quote or generate final assets yet."
      : "Choose and save a creative direction under the customer's delegated creative authority, then continue this same pack. Do not ask for a mandatory direction preview."
    : "";
  return {
    ready: missing.length === 0,
    missing,
    assumptions,
    next_action: [
      ...(inputGaps.length
        ? [`Keep making this pack. Ask once for: ${inputGaps.map(key => labels[key]).join("; ")}.`]
        : []),
      ...(directionAction ? [directionAction] : []),
      ...(!missing.length
        ? ["Show the creative direction and complete quote, then request spending approval."]
        : []),
    ].join(" "),
  };
}
