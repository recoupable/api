import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_PRESET_NAME } from "@/lib/flamingo/presets/fullReport";
import { executeFullReport } from "@/lib/flamingo/executeFullReport";
import { chargeForFlamingoCall } from "@/lib/flamingo/chargeForFlamingoCall";
import type { FlamingoGenerateBody } from "@/lib/flamingo/flamingoGenerateBodySchema";

/**
 * Successful result with a full report. `status` is "partial" when at least
 * one section failed; `failed` lists those sections' report keys.
 */
interface FullReportSuccess {
  type: "success";
  status: "success" | "partial";
  preset: "full_report";
  report: Record<string, unknown>;
  elapsed_seconds: number;
  failed: string[];
}

/** Every section of a full report failed upstream; nothing was charged. */
interface UpstreamError {
  type: "upstream_error";
  error: string;
  failed: string[];
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

export type AnalyzeMusicResult =
  | FullReportSuccess
  | AnalysisSuccess
  | AnalysisError
  | UpstreamError;

/** Who pays for the model calls this request makes. */
export interface AnalyzeMusicContext {
  accountId: string;
  /** Temporary attachment download URLs must not become usage record links. */
  recordAudioUrl?: boolean;
}

/**
 * Shared business logic for music analysis.
 * Used by both POST /api/songs/analyze and the analyze_music MCP tool.
 *
 * Every successful model request is charged to `context.accountId` after it
 * returns, priced on the seconds the model reported (recoupable/app#2061);
 * `full_report` is one batch request. Callers verify `params.audio_url`
 * (`verifyAudioUrl`) and gate the balance on one base price
 * (`FLAMINGO_BASE_CREDITS`) before calling this.
 *
 * @param params - Validated request parameters.
 * @param context - The account the model calls are charged to.
 * @returns Discriminated union with type "success", "error" or
 *   "upstream_error" (every full-report section failed).
 * @throws FlamingoServiceError when a single model call is rejected upstream.
 */
export async function processAnalyzeMusicRequest(
  params: FlamingoGenerateBody,
  context: AnalyzeMusicContext,
): Promise<AnalyzeMusicResult> {
  // Handle full_report preset
  if (params.preset === FULL_REPORT_PRESET_NAME) {
    const { report, elapsed_seconds, failed } = await executeFullReport(
      params.audio_url,
      context.accountId,
      context.recordAudioUrl ?? true,
    );
    if (failed.length > 0 && failed.length === Object.keys(report).length) {
      return { type: "upstream_error", error: "Music analysis failed for every section", failed };
    }
    return {
      type: "success",
      status: failed.length > 0 ? "partial" : "success",
      preset: "full_report",
      report,
      elapsed_seconds,
      failed,
    };
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

  await chargeForFlamingoCall({
    accountId: context.accountId,
    elapsedSeconds: result.elapsed_seconds,
    ...(context.recordAudioUrl === false ? {} : { audioUrl: params.audio_url }),
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
