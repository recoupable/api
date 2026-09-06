import { FLAMINGO_BASE_CREDITS } from "@/lib/flamingo/creditsForFlamingoCall";
import { FULL_REPORT_PRESET_NAME, FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";
import type { FlamingoGenerateBody } from "@/lib/flamingo/validateFlamingoGenerateBody";

/**
 * The base price of an analyze request, for the pre-flight credit gate: one
 * base fee per model call the request will make. `full_report` fans out to
 * one call per section; everything else is a single call. The metered part,
 * priced on the model's reported seconds, lands after the call.
 *
 * @param params - The validated request; only `preset` matters.
 * @returns Credits the account must hold before the model is called.
 */
export function minimumCreditsForAnalyzeRequest(params: Partial<FlamingoGenerateBody>): number {
  const calls = params.preset === FULL_REPORT_PRESET_NAME ? FULL_REPORT_SECTIONS.length : 1;
  return calls * FLAMINGO_BASE_CREDITS;
}
