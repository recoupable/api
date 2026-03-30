import { generateText, Output } from "ai";
import { z } from "zod";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import { CONTENT_TEMPLATES, DEFAULT_CONTENT_TEMPLATE } from "@/lib/content/contentTemplates";

const contentPromptFlagsSchema = z.object({
  lipsync: z
    .boolean()
    .describe(
      "Whether to generate a lipsync video (mouth-synced to audio). True when the user mentions lipsync, lip sync, singing, or mouth movement.",
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
    .enum(["short", "medium", "long"])
    .describe(
      "Caption length: 'short' (default), 'medium', or 'long'. Extract from phrases like 'long caption', 'detailed text', 'brief caption'.",
    ),
  upscale: z
    .boolean()
    .describe(
      "Whether to upscale for higher quality. True when the user mentions high quality, HD, upscale, 4K, or premium.",
    ),
  template: z.string().describe("Which visual template/scene to use for the video."),
});

export type ContentPromptFlags = z.infer<typeof contentPromptFlagsSchema>;

const DEFAULT_FLAGS: ContentPromptFlags = {
  lipsync: false,
  batch: 1,
  captionLength: "short",
  upscale: false,
  template: DEFAULT_CONTENT_TEMPLATE,
};

const templateDescriptions = CONTENT_TEMPLATES.map(t => `- "${t.name}": ${t.description}`).join(
  "\n",
);

const systemPrompt = `You extract content creation parameters from a user's natural-language request.

Available templates:
${templateDescriptions}

If the user doesn't specify a template, default to "${DEFAULT_CONTENT_TEMPLATE}".
If the user doesn't mention a parameter, use the default value.

Defaults: lipsync=false, batch=1, captionLength="short", upscale=false, template="${DEFAULT_CONTENT_TEMPLATE}"`;

/**
 * Parses a natural-language content creation prompt into structured flags
 * for the POST /api/content/create endpoint.
 *
 * Falls back to safe defaults if the AI call fails.
 *
 * @param prompt - The user's natural-language content creation request.
 * @returns Structured flags for the content creation endpoint.
 */
export async function parseContentPrompt(prompt: string): Promise<ContentPromptFlags> {
  try {
    const result = await generateText({
      model: LIGHTWEIGHT_MODEL,
      output: Output.object({ schema: contentPromptFlagsSchema }),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    return result.output ?? DEFAULT_FLAGS;
  } catch (error) {
    console.error("[content-agent] parseContentPrompt failed:", error);
    return DEFAULT_FLAGS;
  }
}
