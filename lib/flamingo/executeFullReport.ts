import { callFlamingoGenerateBatch } from "@/lib/flamingo/callFlamingoGenerateBatch";
import { chargeForBatchAnswers } from "@/lib/flamingo/chargeForBatchAnswers";
import type { FlamingoBatchAnswer } from "@/lib/flamingo/isFlamingoGenerateBatchResult";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";

/**
 * Executes the full_report preset: all 13 sections asked in ONE batch
 * request, so the audio is downloaded once and the per-request base price is
 * paid once instead of 13 times. Each section keeps its preset's prompt,
 * token limit, temperature and sampling choice.
 *
 * The batch runs the sections one after another on one container, so the
 * report takes the sum of the sections' times rather than the longest.
 *
 * The account is charged once, for the sections that came back usable: one
 * base price plus their seconds. A section whose answer is missing or fails
 * to parse is reported as `{ error }`, listed in `failed`, and costs nothing;
 * if the whole batch fails, every section fails and nothing is charged
 * (recoupable/app#2061).
 *
 * @param audioUrl - Public URL to the audio file
 * @param accountId - The account the batch is charged to
 * @param recordAudioUrl - False for temporary host attachment URLs
 * @returns Combined report object with all sections, total elapsed time, and
 *   the report keys of the sections that failed (in report order)
 */
export async function executeFullReport(
  audioUrl: string,
  accountId: string,
  recordAudioUrl = true,
): Promise<{
  report: Record<string, unknown>;
  elapsed_seconds: number;
  failed: string[];
}> {
  const startTime = Date.now();
  const sections = FULL_REPORT_SECTIONS.flatMap(section => {
    const preset = getPreset(section.preset);
    return preset ? [{ reportKey: section.reportKey, preset }] : [];
  });

  let answers: FlamingoBatchAnswer[] = [];
  let batchError: string | null = null;
  try {
    const result = await callFlamingoGenerateBatch({
      audio_url: audioUrl,
      prompts: sections.map(({ reportKey, preset }) => ({
        id: reportKey,
        prompt: preset.prompt,
        max_new_tokens: preset.params.max_new_tokens,
        temperature: preset.params.temperature,
        do_sample: preset.params.do_sample,
      })),
      temperature: 1.0,
      top_p: 1.0,
      do_sample: false,
    });
    answers = result.answers;
  } catch (error) {
    console.error("[WARN] Full report batch failed:", error);
    batchError = error instanceof Error ? error.message : "unknown error";
  }

  // Assemble in narrative order (sections are already ordered)
  const byKey = new Map(answers.map(answer => [answer.id, answer]));
  const report: Record<string, unknown> = {};
  const failed: string[] = [];
  const used: FlamingoBatchAnswer[] = [];
  for (const { reportKey, preset } of sections) {
    const answer = byKey.get(reportKey);
    if (!answer) {
      report[reportKey] = sectionError(
        batchError ?? "the model returned no answer for this section",
      );
      failed.push(reportKey);
      continue;
    }
    try {
      report[reportKey] = preset.parseResponse
        ? preset.parseResponse(answer.response)
        : answer.response;
      used.push(answer);
    } catch (error) {
      console.error(`[WARN] Full report section "${preset.name}" failed to parse:`, error);
      report[reportKey] = sectionError(error instanceof Error ? error.message : "unknown error");
      failed.push(reportKey);
    }
  }

  await chargeForBatchAnswers({
    accountId,
    answers: used,
    ...(recordAudioUrl ? { audioUrl } : {}),
  });

  const totalElapsed = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;

  return { report, elapsed_seconds: totalElapsed, failed };
}

/** The `{ error }` object a failed section reports in place of its data. */
function sectionError(reason: string): { error: string } {
  return { error: `Section failed: ${reason}` };
}
