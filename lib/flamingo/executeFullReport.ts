import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";

/**
 * Result from a single preset within the full report.
 */
interface SectionResult {
  /** The report key this section maps to */
  reportKey: string;
  /** The parsed/processed response data */
  data: unknown;
  /** Inference time for this section in seconds */
  elapsed_seconds: number;
}

/**
 * Executes the full_report preset by running all 13 individual presets
 * in parallel against the same audio URL.
 *
 * Each preset is resolved to its prompt and generation params, sent to
 * the Modal endpoint concurrently, and the results are combined into
 * a single report object in narrative order.
 *
 * @param audioUrl - Public URL to the audio file
 * @returns Combined report object with all sections + total elapsed time
 */
export async function executeFullReport(audioUrl: string): Promise<{
  report: Record<string, unknown>;
  elapsed_seconds: number;
}> {
  const startTime = Date.now();

  // Build all preset calls in parallel
  const promises: Promise<SectionResult | null>[] = FULL_REPORT_SECTIONS.map(
    async (section) => {
      const preset = getPreset(section.preset);
      if (!preset) return null;

      try {
        const result = await callFlamingoGenerate({
          prompt: preset.prompt,
          audio_url: audioUrl,
          max_new_tokens: preset.params.max_new_tokens,
          temperature: preset.params.temperature,
          do_sample: preset.params.do_sample,
        });

        // Apply post-processing if the preset defines one
        const data = preset.parseResponse
          ? preset.parseResponse(result.response)
          : result.response;

        return {
          reportKey: section.reportKey,
          data,
          elapsed_seconds: result.elapsed_seconds,
        };
      } catch (error) {
        console.error(
          `[WARN] Full report section "${section.preset}" failed:`,
          error,
        );
        return {
          reportKey: section.reportKey,
          data: {
            error: `Section failed: ${error instanceof Error ? error.message : "unknown error"}`,
          },
          elapsed_seconds: 0,
        };
      }
    },
  );

  // Execute all presets in parallel
  const results = await Promise.all(promises);

  // Assemble report in narrative order (sections are already ordered)
  const report: Record<string, unknown> = {};
  for (const result of results) {
    if (result) {
      report[result.reportKey] = result.data;
    }
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000 * 100) / 100;

  return { report, elapsed_seconds: totalElapsed };
}
