import {
  recordingSchema,
  youtubeCandidateSchema,
  type Recording,
  type YoutubeCandidate,
} from "./types";
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
/** Conservative metadata screen; audio fingerprint confirmation remains a separate capability. */
export function matchYoutubeRecording(input: Recording, inputs: YoutubeCandidate[]) {
  const recording = recordingSchema.parse(input);
  const title = normalize(recording.title.replace(/\s*\((?:feat\.?|ft\.?).*?\)/gi, ""));
  const alternatives = [
    "live",
    "remix",
    "acoustic",
    "instrumental",
    "karaoke",
    "cover",
    "sped up",
    "slowed",
    "clean",
    "radio edit",
  ];
  const candidates = [
    ...new Map(inputs.map(c => [c.id, youtubeCandidateSchema.parse(c)])).values(),
  ];
  const decisions = candidates.map(candidate => {
    const text = normalize(candidate.title);
    const reasons: string[] = [];
    if (!text.includes(title)) reasons.push("Song title does not match");
    if (
      !recording.artists.every(artist =>
        normalize(candidate.title + " " + (candidate.channel ?? "")).includes(normalize(artist)),
      )
    )
      reasons.push("Not all credited artists are present");
    if (candidate.duration == null || Math.abs(candidate.duration - recording.durationSeconds) > 3)
      reasons.push("Duration is missing or differs by more than three seconds");
    if (
      alternatives.some(
        version => text.includes(version) && !normalize(recording.title).includes(version),
      )
    )
      reasons.push("Possible alternate recording version");
    return { candidate, reasons, eligible: reasons.length === 0 };
  });
  const eligible = decisions.filter(d => d.eligible);
  return {
    status: eligible.length === 1 ? "matched" : "needs_review",
    selected: eligible.length === 1 ? eligible[0].candidate : null,
    verification: "metadata_only",
    decisions,
  };
}
