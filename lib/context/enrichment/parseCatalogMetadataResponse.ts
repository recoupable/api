import { z } from "zod";
import { parseJsonLike } from "@/lib/flamingo/presets/parseJsonLike";

const text = z.string().trim().min(1);
const tags = (max?: number) => (max ? z.array(text).max(max) : z.array(text));
const scale = z.number().min(1).max(10);

/**
 * Mirrors the fields and limits the `catalog_metadata` preset prompt defines: an integer tempo,
 * 1-10 energy and danceability, and at most 3 subgenres, 5 moods, 3 lyrical themes and 3 similar
 * artists. Strings must be non-empty after trimming. Every field is optional; nothing is invented.
 */
export const catalogMetadataSchema = z.object({
  genre: text.nullish(),
  subgenres: tags(3).nullish(),
  mood: tags(5).nullish(),
  tempo_bpm: z.number().int().positive().nullish(),
  key: text.nullish(),
  time_signature: text.nullish(),
  instruments: tags().nullish(),
  vocal_type: text.nullish(),
  vocal_style: text.nullish(),
  production_style: text.nullish(),
  energy_level: scale.nullish(),
  danceability: scale.nullish(),
  lyrical_themes: tags(3).nullish(),
  similar_artists: tags(3).nullish(),
  description: text.nullish(),
});
export type CatalogMetadata = z.infer<typeof catalogMetadataSchema>;
export type CatalogMetadataParseResult =
  | { status: "valid"; parsed: CatalogMetadata }
  | { status: "invalid"; reason: string; rawLength: number };

/**
 * Separate the raw Music Flamingo answer from a validated catalog metadata record. Production already
 * applies the preset's JSON-like parser and falls back to the raw string, so both shapes arrive here.
 * Never throws on bad model output; the caller decides what an invalid result means.
 *
 * @param raw - The `response` field of the production analyze endpoint: an object or the raw text.
 * @returns A validated record, or the reason validation failed plus the raw length for diagnostics.
 */
export function parseCatalogMetadataResponse(raw: unknown): CatalogMetadataParseResult {
  const rawLength = typeof raw === "string" ? raw.length : JSON.stringify(raw ?? null).length;
  const invalid = (reason: string): CatalogMetadataParseResult => ({
    status: "invalid",
    reason,
    rawLength,
  });
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = parseJsonLike(raw);
    } catch {
      return invalid("Response is neither JSON nor a Python-style dict");
    }
  }
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
    return invalid("Parsed response is not a JSON object");
  const result = catalogMetadataSchema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0];
    return invalid(`Field ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  if (Object.values(result.data).every(value => value === undefined || value === null))
    return invalid("No recognized catalog metadata fields");
  return { status: "valid", parsed: result.data };
}
