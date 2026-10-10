import { z } from "zod";

// Ordered so the first match is the most specific plausible value for a field.
// Spotify and YouTube IDs are syntactic fixtures only; nothing is fetched or resolved.
const candidates: unknown[] = [
  "key-1",
  "a".repeat(64),
  "11111111-1111-4111-8111-111111111111",
  "https://open.spotify.com/album/abcdefghijklmnopqrstuv",
  "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
  "https://www.youtube.com/watch?v=AbCdEfGhI_1",
  "2026-01-01",
  1,
  0,
  -1,
  1000,
  true,
  false,
];

function buildValue(key: string, field: z.ZodType): unknown {
  if (field instanceof z.ZodObject) return buildContextOperationFixture(field);
  if (field instanceof z.ZodLiteral) return field.value;
  if (field instanceof z.ZodEnum) return field.options[0];
  if (field instanceof z.ZodArray)
    return field.safeParse([]).success ? [] : [buildValue(key, field.element as z.ZodType)];
  const value = candidates.find(candidate => field.safeParse(candidate).success);
  if (value === undefined) throw new Error(`No fixture candidate satisfies field ${key}`);
  return value;
}

/**
 * Build the smallest valid input for one Context operation schema without a per-action map,
 * so every current and future action in the discriminated union is covered automatically.
 * Optional and defaulted fields are omitted; required fields take the first valid candidate.
 */
export function buildContextOperationFixture(schema: z.ZodObject): Record<string, unknown> {
  const fixture: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    if (field instanceof z.ZodOptional || field instanceof z.ZodDefault) continue;
    fixture[key] = buildValue(key, field as z.ZodType);
  }
  return fixture;
}
