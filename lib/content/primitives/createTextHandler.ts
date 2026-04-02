import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createTextBodySchema } from "./schemas";

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
    const recoupApiUrl = process.env.RECOUP_API_URL ?? "https://recoup-api.vercel.app";
    const recoupApiKey = process.env.RECOUP_API_KEY;
    if (!recoupApiKey) {
      return NextResponse.json(
        { status: "error", error: "RECOUP_API_KEY is not configured" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    const prompt = `Generate ONE short on-screen text for a social media video.
Topic: "${validated.topic}"
Length: ${validated.length}
Return ONLY the text, nothing else. No quotes.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${recoupApiUrl}/api/chat/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": recoupApiKey },
        body: JSON.stringify({
          prompt,
          model: "google/gemini-2.5-flash",
          excludeTools: ["create_task"],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return NextResponse.json(
          { status: "error", error: `Text generation failed: ${response.status}` },
          { status: 502, headers: getCorsHeaders() },
        );
      }

      const json = (await response.json()) as {
        text?: string | Array<{ type: string; text?: string }>;
      };

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
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Text generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Text generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
