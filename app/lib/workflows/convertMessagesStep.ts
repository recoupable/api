import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

/**
 * Convert the turn's UI messages to model messages, once, before the loop.
 *
 * A `"use step"` for two reasons: `convertToModelMessages` can perform I/O
 * (it downloads file parts), which is illegal in workflow context; and the
 * result is journaled, so a replay reuses it instead of re-downloading.
 *
 * The workflow body owns the resulting array and appends each iteration's
 * `responseMessages` to it, which is how iteration N+1 sees iteration N's
 * tool results.
 */
export async function convertMessagesStep(messages: UIMessage[]): Promise<ModelMessage[]> {
  "use step";

  return convertToModelMessages(messages);
}
