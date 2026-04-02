import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createTextBodySchema } from "./schemas";

/**
 *
 * @param topic
 * @param length
 */
/**
 * Builds the LLM prompt for caption generation.
 *
 * @param topic - Subject or theme for the caption.
 * @param length - Desired caption length tier.
 * @returns Formatted prompt string.
 */
function composeCaptionPrompt(topic: string, length: string): string {
  return `Generate ONE short on-screen text for a social media video.
Topic: "${topic}"
Length: ${length}
Return ONLY the text, nothing else. No quotes.`;
}

/**
 *
 * @param prompt
 */
/**
 * Calls the Recoup Chat Generate API with an abort timeout.
 *
 * @param prompt - The prompt to send.
 * @returns The raw fetch Response.
 */
async function callRecoupGenerate(prompt: string): Promise<Response> {
  const recoupApiUrl = process.env.RECOUP_API_URL ?? "https://recoup-api.vercel.app";
  const recoupApiKey = process.env.RECOUP_API_KEY;
  if (!recoupApiKey) throw new Error("RECOUP_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(`${recoupApiUrl}/api/chat/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": recoupApiKey },
      body: JSON.stringify({
        prompt,
        model: "google/gemini-2.5-flash",
        excludeTools: ["create_task"],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 *
 * @param json
 * @param json.text
 */
/**
 * Extracts and cleans text content from the chat generate response.
 *
 * @param json - Parsed JSON response body.
 * @param json.text - Text field (string or parts array).
 * @returns Cleaned text string.
 */
function normalizeGeneratedText(json: {
  text?: string | Array<{ type: string; text?: string }>;
}): string {
  let content: string;
  if (typeof json.text === "string") {
    content = json.text.trim();
  } else if (Array.isArray(json.text)) {
    content = json.text
      .filter(p => p.type === "text" && p.text)
      .map(p => p.text!)
      .join("")
      .trim();
  } else {
    content = "";
  }
  return content.replace(/^["']|["']$/g, "").trim();
}

/**
 * POST /api/content/generate-caption
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
    const prompt = composeCaptionPrompt(validated.topic, validated.length);
    const response = await callRecoupGenerate(prompt);

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", error: `Text generation failed: ${response.status}` },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    const content = normalizeGeneratedText(await response.json());

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
