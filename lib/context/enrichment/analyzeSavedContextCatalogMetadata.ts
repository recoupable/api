import { createHash } from "node:crypto";
import { z } from "zod";
import { getPreset } from "@/lib/flamingo/presets/getPreset";
import { runContextEnrichment } from "./runContextEnrichment";
import { loadAcceptedContextAudioSource } from "./loadAcceptedContextAudioSource";
import { resolveSongEvidenceCoverage } from "./resolveSongEvidenceCoverage";
import { parseCatalogMetadataResponse } from "./parseCatalogMetadataResponse";
import { ContextStructuredOutputInvalid } from "./ContextStructuredOutputInvalid";
import {
  requestSavedContextAudioAnalysis,
  type SavedContextAudioRequestDependencies,
} from "./requestSavedContextAudioAnalysis";

const PRESET_NAME = "catalog_metadata";
const NORMALIZATION = "catalog-metadata-json-v1";
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> &
  SavedContextAudioRequestDependencies<{ audio_url: string; preset: typeof PRESET_NAME }>;
/** Keeps every key production returns (for example `preset`) so the trace holds the full body. */
const responseSchema = z.looseObject({
  status: z.literal("success"),
  response: z.unknown().refine(value => value !== undefined && value !== null),
  elapsed_seconds: z.number().optional(),
});

/**
 * Run the `catalog_metadata` preset on verified full-song audio already saved for a recording and
 * persist the validated JSON as a separate `catalog_metadata` interpretation. The endpoint response
 * body, the validated record, the coverage result and the accepted document stay distinct; invalid
 * structured output fails the attempt instead of being accepted. Compatible accepted results are reused.
 *
 * @param actor - Authenticated account performing the analysis.
 * @param owner - Workspace owner of the Context request.
 * @param requestId - Context request holding the accepted audio source.
 * @param subjectId - Recording subject to analyze.
 * @param apiKey - Production API key, used only by the default HTTP caller and never persisted.
 * @param deps - Authorization, RPC and optional injected file, signing and provider dependencies.
 * @returns The enrichment receipt from `runContextEnrichment`.
 */
export async function analyzeSavedContextCatalogMetadata(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
  apiKey: string,
  deps: Dependencies,
) {
  z.uuid().parse(subjectId);
  await deps.authorize(actor, owner);
  const { resultId, asset } = await loadAcceptedContextAudioSource(
    deps.rpc,
    owner,
    requestId,
    subjectId,
  );
  const evidence = resolveSongEvidenceCoverage({ audioSource: asset });
  if (evidence.label !== "full")
    throw new Error(`Saved audio is not verified full-song evidence (${evidence.label})`);
  const preset = getPreset(PRESET_NAME);
  if (!preset) throw new Error("catalog_metadata preset is not registered");
  const presetVersion = createHash("sha256")
    .update(JSON.stringify([preset.prompt, preset.params]))
    .digest("hex");
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "saved-audio-catalog-metadata-v1",
      topic: PRESET_NAME,
      subjectId,
      provider: "recoup-production",
      model: "nvidia/music-flamingo-2601-hf",
      input: {
        audioSourceResultId: resultId,
        sha256: asset.sha256,
        preset: PRESET_NAME,
        presetVersion,
        normalization: NORMALIZATION,
      },
      sources: [
        {
          url: asset.youtubeUrl,
          kind: "audio",
          content: {
            audioSourceResultId: resultId,
            sha256: asset.sha256,
            durationSeconds: asset.durationSeconds,
          },
        },
      ],
    },
    {
      ...deps,
      call: async () => {
        const { responseBody, startedAt } = await requestSavedContextAudioAnalysis(
          asset,
          audio_url => ({ audio_url, preset: PRESET_NAME }),
          apiKey,
          deps,
        );
        const raw = responseSchema.parse(responseBody);
        const validation = parseCatalogMetadataResponse(raw.response);
        if (validation.status === "invalid")
          throw new ContextStructuredOutputInvalid(validation.reason, validation.rawLength);
        return {
          content: {
            schemaVersion: 1,
            metadata: validation.parsed,
            metadataStatus: "model interpretation; not independently verified",
            audioSourceResultId: resultId,
            audioSha256: asset.sha256,
            durationSeconds: asset.durationSeconds,
            inputScope: "complete saved WAV",
            coverage: evidence.coverage,
            coverageLabel: evidence.label,
          },
          coverage: evidence.persistedCoverage,
          costUsd: null,
          costStatus: "unknown",
          trace: {
            preset: { name: preset.name, prompt: preset.prompt, params: preset.params },
            promptProvenance:
              "Local preset definition; production resolves the preset name. The deployed resolved prompt is not returned.",
            media: [
              {
                coverage: evidence.label,
                startSeconds: evidence.coverage.startSeconds,
                endSeconds: evidence.coverage.endSeconds,
                sha256: asset.sha256,
              },
            ],
            rawResponse: raw,
            validation: { status: validation.status, normalization: NORMALIZATION },
            elapsedMs: Date.now() - startedAt,
            billing:
              "Production audio endpoint charges the API-key account; no duplicate local debit. Endpoint does not return a confirmed cost.",
          },
        };
      },
    },
  );
}
