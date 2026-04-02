import { z } from "zod";
import { compositionPlanSchema } from "./compositionPlanSchema";
import { elevenLabsOutputFormatSchema } from "./outputFormats";

/**
 * Base fields shared by compose, compose/detailed, and stream endpoints.
 * Each endpoint extends this with its own additional fields.
 */
export const musicGenerationBaseFields = {
  prompt: z.string().max(4100).nullable().optional(),
  composition_plan: compositionPlanSchema.nullable().optional(),
  music_length_ms: z.number().int().min(3000).max(600000).nullable().optional(),
  model_id: z.enum(["music_v1"]).optional().default("music_v1"),
  seed: z.number().int().min(0).max(2147483647).nullable().optional(),
  force_instrumental: z.boolean().optional().default(false),
  store_for_inpainting: z.boolean().optional().default(false),
  output_format: elevenLabsOutputFormatSchema.optional(),
};

/** Refinement: exactly one of prompt or composition_plan must be provided. */
export const promptOrPlanRefinements = [
  {
    check: (data: { prompt?: string | null; composition_plan?: unknown }) =>
      !(data.prompt && data.composition_plan),
    message: "Cannot use both prompt and composition_plan",
  },
  {
    check: (data: { prompt?: string | null; composition_plan?: unknown }) =>
      !!(data.prompt || data.composition_plan),
    message: "Must provide either prompt or composition_plan",
  },
] as const;
