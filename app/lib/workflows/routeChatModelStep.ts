import type { UIMessage, UIMessageChunk } from "ai";
import { selectChatModel } from "@/lib/ai/routing/selectChatModel";

/** Stream the routing status and journal the decision before any agent tool runs. */
export async function routeChatModelStep(
  messages: UIMessage[],
  writable: WritableStream<UIMessageChunk>,
) {
  "use step";

  const writer = writable.getWriter();
  try {
    await writer.write({
      type: "message-metadata",
      messageMetadata: { selectedModelId: "auto", routing: { status: "selecting" } },
    });
    const selection = await selectChatModel("auto", messages);
    const metadata = {
      ...(selection.routing?.costUsd === undefined
        ? {}
        : { totalMessageCost: selection.routing.costUsd }),
      selectedModelId: "auto",
      modelId: selection.modelId,
      routing: { ...selection.routing, status: "selected" },
    };
    await writer.write({ type: "message-metadata", messageMetadata: metadata });
    return { ...selection, metadata };
  } finally {
    writer.releaseLock();
  }
}
