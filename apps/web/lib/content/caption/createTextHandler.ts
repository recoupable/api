import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateText from "@/lib/ai/generateText";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import { loadTemplate } from "@/lib/content/templates";
import { validateCreateCaptionBody } from "./validateCreateCaptionBody";
import { composeCaptionPrompt } from "./composeCaptionPrompt";

/**
 * POST /api/content/caption
 *
 * @param request - Incoming Next.js request with JSON body.
 * @returns JSON with generated text styling fields, or an error NextResponse.
 */
export async function createTextHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateCaptionBody(request);
  if (validated instanceof NextResponse) return validated;

  try {
    const template = validated.template ? loadTemplate(validated.template) : null;
    const prompt = composeCaptionPrompt(validated.topic, validated.length, template);
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
