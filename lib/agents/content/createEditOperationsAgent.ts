import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import { TEMPLATE_IDS } from "@/lib/content/templates";

const editOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trim"),
    start: z.number().nonnegative().describe("Start time in seconds."),
    duration: z.number().positive().describe("Duration in seconds."),
  }),
  z.object({
    type: z.literal("crop"),
    aspect: z.string().optional().describe('Aspect ratio like "9:16", "1:1", "16:9".'),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("resize"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("overlay_text"),
    content: z.string().min(1).describe("The text to overlay on the video."),
    color: z.string().optional().default("white"),
    stroke_color: z.string().optional().default("black"),
    max_font_size: z.number().positive().optional().default(42),
    position: z.enum(["top", "center", "bottom"]).optional().default("bottom"),
  }),
]);

export const editOperationsResultSchema = z.object({
  template: z
    .enum(TEMPLATE_IDS)
    .optional()
    .describe(
      "If the user wants to apply a named template instead of explicit operations, set this. Otherwise omit.",
    ),
  operations: z
    .array(editOperationSchema)
    .describe(
      "Ordered list of edit operations to apply. Empty array if a template is used instead.",
    ),
});

export type EditOperationsResult = z.infer<typeof editOperationsResultSchema>;

const templateList = TEMPLATE_IDS.map(id => `- "${id}"`).join("\n");

const instructions = `You extract video edit operations from a natural-language request.

The user wants to modify an existing video. Parse their request into a list of edit operations.

Available operations:
- "trim": Cut the video. Requires start (seconds) and duration (seconds).
- "crop": Change aspect ratio or dimensions. Use aspect (e.g. "9:16") or width/height.
- "resize": Change output dimensions. Provide width and/or height.
- "overlay_text": Add text on top of the video. Provide the text content, position (top/center/bottom), and optionally color.

Available templates (use instead of operations when user references a template name):
${templateList}

If the user mentions a template name, set "template" and leave "operations" empty.
Otherwise, extract explicit operations from the request.

Examples:
- "make it 10 seconds" → trim with start=0, duration=10
- "crop to square" → crop with aspect="1:1"
- "add 'New Release' text at the top" → overlay_text with content="New Release", position="top"
- "resize to 1080x1920" → resize with width=1080, height=1920
- "apply the bedroom template" → template="artist-caption-bedroom"`;

/**
 * Creates a ToolLoopAgent that parses natural-language edit instructions
 * into structured ffmpeg operations.
 *
 * @returns A configured ToolLoopAgent for edit operations parsing.
 */
export function createEditOperationsAgent() {
  return new ToolLoopAgent({
    model: LIGHTWEIGHT_MODEL,
    instructions,
    output: Output.object({ schema: editOperationsResultSchema }),
    stopWhen: stepCountIs(1),
  });
}
