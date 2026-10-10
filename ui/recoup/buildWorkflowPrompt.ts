/** Keep the selection as a user request, never as execution authority. */
export function buildWorkflowPrompt(
  feature: { title: string; skill: string; mode: string; outputs: string[] },
  brief = "",
): string {
  if (brief.length > 4000) throw new Error("Keep the brief to 4,000 characters.");
  return `Help me use the Recoup "${feature.title}" workflow.\nUse the ${feature.skill} skill if available (mode: ${feature.mode}).\n${brief.trim() ? `My brief:\n${brief.trim()}\n\n` : ""}Start from our existing conversation and any music, artist, album, or catalog already identified. Ask only for missing essentials. Intended outputs: ${feature.outputs.join(", ")}. Check which tools and source files are available before promising an output. The gallery film is an example, not my source material. If a skill or capability is unavailable, explain the gap and help with the supported next step.`;
}
