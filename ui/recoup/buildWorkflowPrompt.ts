/** Keep the selection as a user request, never as execution authority. */
export function buildWorkflowPrompt(
  feature: { title: string; skill: string; mode: string; outputs: string[] },
  brief = "",
): string {
  if (brief.length > 4000) throw new Error("Keep the brief to 4,000 characters.");
  const audioGuidance =
    feature.skill === "recoup-song-analyze-audio"
      ? "For song analysis, use audio already attached to this chat. Pass the host-provided file to analyze_music when supported, or an existing accessible attachment URL. If no song is attached, say: Please attach your song here (MP3, WAV, or FLAC), and I’ll analyze its sound, BPM, key, genre, and mood. Do not ask the user to host audio or turn it into a URL. If the attachment is a local file path, use upload_release_pack_asset mode=signed_url, transfer only that selected file with the local upload helper, finalize the upload, and analyze the verified URL. No release pack or API-key extraction is needed. If that tool is missing, identify the outdated connection/tool list; do not ask for a public URL or another attachment. Use catalog_metadata for the default overview; full_report only when explicitly requested. Keep skill names, tool setup, and gallery-source instructions out of the customer reply. "
      : "";
  return `Help me use the Recoup "${feature.title}" workflow.\nUse the ${feature.skill} skill if available (mode: ${feature.mode}).\n${brief.trim() ? `My brief:\n${brief.trim()}\n\n` : ""}${audioGuidance}Start from our existing conversation and any music, artist, album, or catalog already identified. Ask only for missing essentials. Intended outputs: ${feature.outputs.join(", ")}. Check which tools and source files are available before promising an output. The gallery film is an example, not my source material. If a skill or capability is unavailable, explain the gap and help with the supported next step.`;
}
