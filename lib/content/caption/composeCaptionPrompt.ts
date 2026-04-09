import type { Template } from "@/lib/content/templates";

/**
 * Builds the LLM prompt for caption generation, optionally with template guide.
 *
 * @param topic - Subject or theme for the caption.
 * @param length - Desired caption length tier.
 * @param tpl - Optional template with caption guide and examples.
 * @returns Formatted prompt string.
 */
export function composeCaptionPrompt(topic: string, length: string, tpl: Template | null): string {
  let prompt = `Generate ONE short on-screen text for a social media video.
Topic: "${topic}"
Length: ${length}
Return ONLY the text, nothing else. No quotes.`;

  if (tpl?.caption.guide) {
    const g = tpl.caption.guide;
    prompt += `\n\nStyle: ${g.tone}`;
    if (g.rules.length) prompt += `\nRules:\n${g.rules.map(r => `- ${r}`).join("\n")}`;
    if (g.formats.length) prompt += `\nFormats to try:\n${g.formats.map(f => `- ${f}`).join("\n")}`;
  }

  if (tpl?.caption.examples.length) {
    prompt += `\n\nExamples of good captions:\n${tpl.caption.examples.map(e => `- "${e}"`).join("\n")}`;
  }

  return prompt;
}
