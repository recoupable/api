/** Keep the selection as a user request, never as execution authority. */
export function buildWorkflowPrompt(
  feature: { title: string; skill: string; mode: string; outputs: string[] },
  brief: string,
): string {
  if (!brief.trim() || brief.length > 4000)
    throw new Error("Add a brief of up to 4,000 characters.");
  return `I want to ${feature.title.toLowerCase()} using Recoup.\nUse the ${feature.skill} skill if available (mode: ${feature.mode}).\nMy brief:\n${brief.trim()}\n\nStart from these inputs and our existing conversation. Ask only for missing essentials. Intended outputs: ${feature.outputs.join(", ")}. Check which tools and source files are available before promising an output. The gallery film is an example, not my source material. If a skill or capability is unavailable, explain the gap and help with the supported next step.`;
}
