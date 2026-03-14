import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_PRESET_NAME } from "@/lib/flamingo/presets/fullReport";
import { executeFullReport } from "@/lib/flamingo/executeFullReport";
import type { FlamingoGenerateBody } from "@/lib/flamingo/validateFlamingoGenerateBody";

/** Successful result with a full report. */
interface FullReportSuccess {
  type: "success";
  preset: "full_report";
  report: Record<string, unknown>;
  elapsed_seconds: number;
}

/** Successful result with a single analysis response. */
interface AnalysisSuccess {
  type: "success";
  preset?: string;
  response: unknown;
  elapsed_seconds: number;
}

/** Error result. */
interface AnalysisError {
  type: "error";
  error: string;
}

export type AnalyzeMusicResult = FullReportSuccess | AnalysisSuccess | AnalysisError;

/**
 * Shared business logic for music analysis.
 * Used by both POST /api/songs/analyze and the analyze_music MCP tool.
 *
 * @param params - Validated request parameters.
 * @returns Discriminated union with type "success" or "error".
 */
export async function processAnalyzeMusicRequest(
  params: FlamingoGenerateBody,
): Promise<AnalyzeMusicResult> {
  // Handle full_report preset
  if (params.preset === FULL_REPORT_PRESET_NAME) {
    if (!params.audio_url) {
      return {
        type: "error",
        error: "audio_url is required for the full_report preset",
      };
    }
    const { report, elapsed_seconds } = await executeFullReport(params.audio_url);
    return { type: "success", preset: "full_report", report, elapsed_seconds };
  }

  // Resolve individual preset to prompt + params
  let prompt = params.prompt ?? "";
  let maxNewTokens = params.max_new_tokens;
  let temperature = params.temperature;
  let topP = params.top_p;
  let doSample = params.do_sample;
  let presetName: string | undefined;
  let parseResponse: ((raw: string) => unknown) | undefined;

  if (params.preset) {
    const preset = getPreset(params.preset);
    if (!preset) {
      return { type: "error", error: `Unknown preset: ${params.preset}` };
    }
    if (preset.requiresAudio && !params.audio_url) {
      return {
        type: "error",
        error: `The "${preset.name}" preset requires an audio_url`,
      };
    }
    prompt = preset.prompt;
    maxNewTokens = preset.params.max_new_tokens;
    temperature = preset.params.temperature;
    topP = undefined;
    doSample = preset.params.do_sample;
    presetName = preset.name;
    parseResponse = preset.parseResponse;
  }

  // Call the Music Flamingo model — throws on infrastructure errors
  const result = await callFlamingoGenerate({
    prompt,
    audio_url: params.audio_url,
    max_new_tokens: maxNewTokens,
    temperature,
    top_p: topP,
    do_sample: doSample,
  });

  // Apply post-processing if the preset defines one
  let response: unknown = result.response;
  if (parseResponse) {
    try {
      response = parseResponse(result.response);
    } catch {
      response = result.response;
    }
  }

  return {
    type: "success",
    ...(presetName ? { preset: presetName } : {}),
    response,
    elapsed_seconds: result.elapsed_seconds,
  };
}
