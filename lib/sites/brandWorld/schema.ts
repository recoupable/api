import { z } from "zod";

const text = z.string().min(1).max(1200);
const index = z.number().int().nonnegative();

/** Required fields (nullable where absent) also work with strict structured-output providers. */
export const brandWorldSchema = z.object({
  evidenceMode: z.enum(["artwork", "brief-only"]),
  observations: z
    .array(
      z.object({
        sourceIndex: index,
        visible: text.describe("Only visible evidence, not artist intent or inferred music."),
        interpretation: text.describe("Explicit creative interpretation of that evidence."),
      }),
    )
    .max(16),
  direction: z.object({
    concept: text,
    preserve: z.array(text).min(1).max(8),
    avoid: z.array(text).min(1).max(8),
    override: text.describe(
      "How the latest customer instruction steers the artwork; say none when absent.",
    ),
    coverHiddenTest: text.describe(
      "Specific visual signatures that remain when the cover image is removed.",
    ),
  }),
  system: z.object({
    palette: z
      .array(
        z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), role: text, rationale: text }),
      )
      .min(2)
      .max(6),
    typography: text,
    composition: text,
    materials: text,
    shapes: text,
    depth: text,
    motion: text,
    interaction: text,
  }),
  assets: z
    .array(
      z.object({
        purpose: text,
        production: z.enum(["supplied", "procedural", "defer"]),
        sourceIndex: index.nullable(),
        guidance: text,
        fallback: text,
      }),
    )
    .min(1)
    .max(8),
  surfaces: z.object({
    entry: text,
    experience: text,
    controls: text,
    connection: text,
    player: text,
    completion: text,
    loadingAndError: text,
  }),
  qualityChecks: z.array(text).min(2).max(10),
});
export type BrandWorld = z.infer<typeof brandWorldSchema>;
