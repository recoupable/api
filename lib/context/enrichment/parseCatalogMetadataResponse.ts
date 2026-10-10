import { z } from "zod";
import { parseJsonLike } from "@/lib/flamingo/presets/parseJsonLike";

/** Mirrors the fields the `catalog_metadata` preset asks for. Everything is optional; nothing is invented. */
export const catalogMetadataSchema = z.object({
  genre: z.string().nullish(),
  subgenres: z.array(z.string()).nullish(),
  mood: z.array(z.string()).nullish(),
  tempo_bpm: z.number().int().nullish(),
  key: z.string().nullish(),
  time_signature: z.string().nullish(),
  instruments: z.array(z.string()).nullish(),
  vocal_type: z.string().nullish(),
  vocal_style: z.string().nullish(),
  production_style: z.string().nullish(),
  energy_level: z.number().nullish(),
  danceability: z.number().nullish(),
  lyrical_themes: z.array(z.string()).nullish(),
  similar_artists: z.array(z.string()).nullish(),
  description: z.string().nullish(),
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
