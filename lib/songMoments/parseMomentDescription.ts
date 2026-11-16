import { parseJsonLike } from "@/lib/flamingo/presets/parseJsonLike";

/** What Music Flamingo says about one moment after hearing just that clip. */
export interface MomentDescription {
  description: string | null;
  emotion: string[];
  best_for: string[];
  vocals: boolean | null;
}

const MAX_TAGS = 3;
const MAX_DESCRIPTION_CHARS = 300;

function tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .map(tag => tag.trim().toLowerCase())
    .slice(0, MAX_TAGS);
}

/**
 * Reads the model's JSON-ish reply about a clip into a fixed shape. Takes the
 * first `{...}` block, tolerates single quotes, and drops anything malformed
 * rather than failing: a missing field comes back empty, never invented.
 *
 * @param raw - The model's text response.
 * @returns The description fields, empty where the reply had nothing usable.
 */
export function parseMomentDescription(raw: string): MomentDescription {
  const empty: MomentDescription = { description: null, emotion: [], best_for: [], vocals: null };
  const block = raw.match(/\{[\s\S]*\}/);
  if (!block) return empty;

  let parsed: unknown;
  try {
    parsed = parseJsonLike(block[0]);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;
  const fields = parsed as Record<string, unknown>;

  const description =
    typeof fields.description === "string" && fields.description.trim()
      ? fields.description.trim().slice(0, MAX_DESCRIPTION_CHARS)
      : null;
  return {
    description,
    emotion: tags(fields.emotion),
    best_for: tags(fields.best_for),
    vocals: typeof fields.vocals === "boolean" ? fields.vocals : null,
  };
}
