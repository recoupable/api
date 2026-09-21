import { getPreset } from "@/lib/flamingo/presets/getPreset";
import type { ContextEnrichmentResult } from "./runContextEnrichment";
/** Existing production endpoint owns its API-key authentication and credit charge. Never debit locally too. */
export async function callContextMusicPreset(
  audioUrl: string,
  presetName: "catalog_metadata" | "lyric_transcription",
  apiKey: string,
): Promise<ContextEnrichmentResult> {
  const preset = getPreset(presetName)!;
  const body = { audio_url: audioUrl, preset: presetName };
  const started = Date.now();
  const response = await fetch("https://api.recoupable.com/api/songs/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const raw = await response.json();
  if (!response.ok || raw.status !== "success")
    throw new Error(`Music Flamingo failed HTTP ${response.status}`);
  return {
    content: raw.response,
    coverage: "partial",
    costUsd: null,
    costStatus: "unknown",
    trace: {
      provider: "recoup-production",
      model: "nvidia/music-flamingo-2601-hf",
      request: body,
      preset: { name: preset.name, prompt: preset.prompt, params: preset.params },
      promptProvenance:
        "Local preset definition; production resolves preset name. The deployed resolved prompt is not returned.",
      media: [{ url: audioUrl, coverage: "preview", startSeconds: null, endSeconds: null }],
      rawResponse: raw,
      elapsedMs: Date.now() - started,
      billing:
        "Production endpoint charges the API-key account; no duplicate local debit. Endpoint does not return a confirmed cost.",
    },
  };
}
