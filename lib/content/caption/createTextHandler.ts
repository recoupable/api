import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "@/lib/content/validatePrimitiveBody";
import { createTextBodySchema } from "@/lib/content/schemas";
import generateText from "@/lib/ai/generateText";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import { loadTemplate } from "@/lib/content/templates";
import type { Template } from "@/lib/content/templates";

/**
 * Builds the LLM prompt for caption generation, optionally with template guide.
 *
 * @param topic - Subject or theme for the caption.
 * @param length - Desired caption length tier.
 * @param tpl - Optional template with caption guide and examples.
 * @returns Formatted prompt string.
 */
function composeCaptionPrompt(topic: string, length: string, tpl: Template | null): string {
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

/**
 * POST /api/content/caption
 *
 * @param request - Incoming Next.js request with JSON body validated by the text primitive schema.
 * @returns JSON with generated text styling fields, or an error NextResponse.
 */
export async function createTextHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createTextBodySchema);
  if (validated instanceof NextResponse) return validated;

  try {
    const tpl = validated.template ? loadTemplate(validated.template) : null;
    const prompt = composeCaptionPrompt(validated.topic, validated.length, tpl);
    const result = await generateText({ prompt, model: LIGHTWEIGHT_MODEL });

    let content = result.text.trim();
    content = content.replace(/^["']|["']$/g, "").trim();

    if (!content) {
      return NextResponse.json(
        { status: "error", error: "Text generation returned empty" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { content, font: null, color: "white", borderColor: "black", maxFontSize: 42 },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Text generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Text generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
