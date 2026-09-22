import { getPreset } from "@/lib/flamingo/presets/getPreset";
import type { ContextEnrichmentResult } from "./runContextEnrichment";
/** Existing production endpoint owns its API-key authentication and credit charge. Never debit locally too. */
export async function callContextMusicPreset(
  audioUrl: string,
  presetName: "catalog_metadata" | "lyric_transcription",
  apiKey: string,
  media: { coverage: "preview" | "full_duration_candidate"; durationSeconds?: number } = {
    coverage: "preview",
  },
): Promise<ContextEnrichmentResult> {
  const preset = getPreset(presetName)!;
  const body = { audio_url: audioUrl, preset: presetName };
  const started = Date.now();
  const response = await fetch("https://api.recoupable.com/api/songs/analyze", {
    method: "POST",
    signal: AbortSignal.timeout(300_000),
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const raw = await response.json();
  if (!response.ok || raw.status !== "success")
    throw new Error(`Music Flamingo failed HTTP ${response.status}`);
  return {
    content: raw.response,
    coverage: media.coverage === "preview" ? "partial" : "unknown",
    costUsd: null,
    costStatus: "unknown",
    trace: {
      provider: "recoup-production",
      model: "nvidia/music-flamingo-2601-hf",
      request: body,
      preset: { name: preset.name, prompt: preset.prompt, params: preset.params },
      promptProvenance:
        "Local preset definition; production resolves preset name. The deployed resolved prompt is not returned.",
      media: [
        {
          url: audioUrl,
          coverage: media.coverage,
          startSeconds: 0,
          endSeconds: media.durationSeconds ?? null,
        },
      ],
      rawResponse: raw,
      elapsedMs: Date.now() - started,
      billing:
        "Production endpoint charges the API-key account; no duplicate local debit. Endpoint does not return a confirmed cost.",
    },
  };
}
