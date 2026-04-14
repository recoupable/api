import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";

export const contentIntentSchema = z.object({
  action: z
    .enum(["edit", "generate"])
    .describe(
      'Whether the user wants to edit/modify the existing content ("edit") or create entirely new content from scratch ("generate"). Use "edit" when the user references changing, adjusting, trimming, cropping, resizing, or adding overlays to the existing video. Use "generate" when the user wants something completely new or different.',
    ),
});

export type ContentIntent = z.infer<typeof contentIntentSchema>;

const instructions = `You classify whether a user's message in a content thread is requesting an edit to existing content or a brand new generation.

Context: The user previously generated content (videos/images) in this Slack thread. They are now replying with a new request. You must decide if they want to modify what was already created or start fresh.

Classify as "edit" when the user wants to:
- Trim, shorten, or change the duration
- Crop or change the aspect ratio
- Resize the video
- Add or change text overlays / captions
- Make adjustments to the existing content
- Phrases like "make it shorter", "add text", "crop to square", "resize to 1080x1920"

Classify as "generate" when the user wants to:
- Create entirely new content with a different template, artist, or style
- Generate more videos
- Phrases like "make another one", "try a different template", "generate 3 more"

When in doubt, prefer "edit" since the user is replying in an existing content thread.`;

/**
 * Creates a ToolLoopAgent that classifies user intent as "edit" or "generate"
 * based on a message in an existing content thread.
 *
 * @returns A configured ToolLoopAgent for intent classification.
 */
export function createContentIntentAgent() {
  return new ToolLoopAgent({
    model: LIGHTWEIGHT_MODEL,
    instructions,
    output: Output.object({ schema: contentIntentSchema }),
    stopWhen: stepCountIs(1),
  });
}
