import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import { CONTENT_TEMPLATES, DEFAULT_CONTENT_TEMPLATE } from "@/lib/content/contentTemplates";
import { CAPTION_LENGTHS } from "@/lib/content/captionLengths";
import { songsSchema } from "@/lib/content/songsSchema";

const templateNames = CONTENT_TEMPLATES.map(t => t.name) as [string, ...string[]];

export const contentPromptFlagsSchema = z.object({
  lipsync: z
    .boolean()
    .describe(
      "Whether to generate a lipsync video (mouth-synced to audio). True when the prompt mentions lipsync, lip sync, singing, or mouth movement.",
    ),
  batch: z
    .number()
    .int()
    .min(1)
    .max(30)
    .describe(
      "How many videos to generate. Extract from phrases like '3 videos', 'a few' (3), 'several' (5). Default 1.",
    ),
  captionLength: z
    .enum(CAPTION_LENGTHS)
    .describe(
      "Caption length: 'none' (default — no captions), 'short', 'medium', or 'long'. Only set to short/medium/long when captions are explicitly requested. Extract from phrases like 'add a caption', 'with captions', 'long caption', 'detailed text'. If no captions are mentioned or 'no captions', use 'none'.",
    ),
  upscale: z
    .boolean()
    .describe(
      "Whether to upscale for higher quality. True when the prompt mentions high quality, HD, upscale, 4K, or premium.",
    ),
  template: z.enum(templateNames).describe("Which visual template/scene to use for the video."),
  songs: songsSchema.describe(
    "Song names or slugs mentioned in the prompt. Extract from phrases like 'the hiccups song', 'use track X', 'for song Y'. Omit if no specific songs are mentioned.",
  ),
  artistName: z
    .string()
    .optional()
    .describe(
      "The artist name mentioned in the prompt. Extract from phrases like 'for Mac Miller', 'generate a video for Gatsby Grace', 'make content for [artist]'. Omit if no artist name is mentioned.",
    ),
});

export type ContentPromptFlags = z.infer<typeof contentPromptFlagsSchema>;

export const DEFAULT_CONTENT_PROMPT_FLAGS: ContentPromptFlags = {
  lipsync: false,
  batch: 1,
  captionLength: "none",
  upscale: false,
  template: DEFAULT_CONTENT_TEMPLATE,
};

const templateDescriptions = CONTENT_TEMPLATES.map(t => `- "${t.name}": ${t.description}`).join(
  "\n",
);

const instructions = `You extract content creation parameters from a natural-language request.

Available templates:
${templateDescriptions}

If no template is specified, default to "${DEFAULT_CONTENT_PROMPT_FLAGS.template}".
If a parameter is not mentioned, use the default value.

Defaults: lipsync=${DEFAULT_CONTENT_PROMPT_FLAGS.lipsync}, batch=${DEFAULT_CONTENT_PROMPT_FLAGS.batch}, captionLength="${DEFAULT_CONTENT_PROMPT_FLAGS.captionLength}", upscale=${DEFAULT_CONTENT_PROMPT_FLAGS.upscale}, template="${DEFAULT_CONTENT_PROMPT_FLAGS.template}"`;

/**
 * Creates a ToolLoopAgent configured for parsing content creation prompts.
 *
 * @returns A configured ToolLoopAgent that extracts structured content flags from natural language.
 */
export function createContentPromptAgent() {
  return new ToolLoopAgent({
    model: LIGHTWEIGHT_MODEL,
    instructions,
    output: Output.object({ schema: contentPromptFlagsSchema }),
    stopWhen: stepCountIs(1),
  });
}
