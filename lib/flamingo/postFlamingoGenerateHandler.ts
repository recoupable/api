import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateFlamingoGenerateBody } from "@/lib/flamingo/validateFlamingoGenerateBody";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_PRESET_NAME } from "@/lib/flamingo/presets/fullReport";
import { executeFullReport } from "@/lib/flamingo/executeFullReport";

/**
 * Handler for POST /api/music/analyze.
 *
 * Authenticates the request, validates the body, resolves any preset
 * to its curated prompt and params, then calls the Music Flamingo model.
 *
 * Supports three modes:
 * 1. Custom prompt: { "prompt": "...", "audio_url": "..." }
 * 2. Individual preset: { "preset": "catalog_metadata", "audio_url": "..." }
 * 3. Full report: { "preset": "full_report", "audio_url": "..." }
 *
 * @param request - The incoming request with a JSON body.
 * @returns A NextResponse with the model output or an error.
 */
export async function postFlamingoGenerateHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // 1. Authenticate — supports both x-api-key and Authorization Bearer
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 2. Parse and validate body
    const body = await request.json();
    const validated = validateFlamingoGenerateBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    // 3. Handle full_report preset — fan out to all presets in parallel
    if (validated.preset === FULL_REPORT_PRESET_NAME) {
      if (!validated.audio_url) {
        return NextResponse.json(
          { status: "error", error: "audio_url is required for the full_report preset" },
          { status: 400, headers: getCorsHeaders() },
        );
      }

      const { report, elapsed_seconds } = await executeFullReport(
        validated.audio_url,
      );

      return NextResponse.json(
        { status: "success", preset: FULL_REPORT_PRESET_NAME, report, elapsed_seconds },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    // 4. Resolve individual preset to prompt + params (if provided)
    let prompt = validated.prompt ?? "";
    let maxNewTokens = validated.max_new_tokens;
    let temperature = validated.temperature;
    let doSample = validated.do_sample;
    let presetName: string | undefined;
    let parseResponse: ((raw: string) => unknown) | undefined;

    if (validated.preset) {
      const preset = getPreset(validated.preset);
      if (!preset) {
        return NextResponse.json(
          { status: "error", error: `Unknown preset: ${validated.preset}` },
          { status: 400, headers: getCorsHeaders() },
        );
      }

      // Check if preset requires audio
      if (preset.requiresAudio && !validated.audio_url) {
        return NextResponse.json(
          {
            status: "error",
            error: `The "${preset.name}" preset requires an audio_url`,
          },
          { status: 400, headers: getCorsHeaders() },
        );
      }

      prompt = preset.prompt;
      maxNewTokens = preset.params.max_new_tokens;
      temperature = preset.params.temperature;
      doSample = preset.params.do_sample;
      presetName = preset.name;
      parseResponse = preset.parseResponse;
    }

    // 5. Call the Music Flamingo model on Modal
    const result = await callFlamingoGenerate({
      prompt,
      audio_url: validated.audio_url,
      max_new_tokens: maxNewTokens,
      temperature,
      do_sample: doSample,
    });

    // 6. Apply post-processing if the preset defines one
    let response: unknown = result.response;
    if (parseResponse) {
      try {
        response = parseResponse(result.response);
      } catch {
        // If post-processing fails, return the raw response
        response = result.response;
      }
    }

    // 7. Return flat response
    return NextResponse.json(
      {
        status: "success",
        ...(presetName ? { preset: presetName } : {}),
        response,
        elapsed_seconds: result.elapsed_seconds,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] Flamingo generate failed:", error);
    const message =
      error instanceof Error ? error.message : "Flamingo inference failed";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
