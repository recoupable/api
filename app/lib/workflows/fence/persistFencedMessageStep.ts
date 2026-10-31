import { projectFencedUIMessage } from "./projectFencedUIMessage";
import { FatalError } from "workflow";
import type { UIMessage } from "ai";
import type { ChatFenceWriter } from "@/lib/chat/fence/chatFenceSchemas";
import { createFencedMessageWriter } from "@/lib/chat/fence/persistence/createFencedMessageWriter";
import { FencedPersistenceError } from "@/lib/chat/fence/persistence/FencedPersistenceError";

/** Required persistence never triggers an automatic step/provider-loop retry. */
export async function persistFencedMessageStep(
  writer: ChatFenceWriter,
  operation: "user" | "assistant" | "update_parts",
  message: UIMessage,
) {
  "use step";
  try {
    const { executeChatFenceCommand } = await import(
      "@/lib/supabase/chat_fence/executeChatFenceCommand"
    );
    const durableMessage = projectFencedUIMessage(message);
    const persistence = createFencedMessageWriter(writer, executeChatFenceCommand);
    if (operation === "user") return await persistence.insertUser(durableMessage);
    if (operation === "assistant") return await persistence.upsertAssistant(durableMessage);
    return await persistence.updateAssistantParts(durableMessage);
  } catch (error) {
    const kind = error instanceof FencedPersistenceError ? error.kind : "invalid_command";
    throw new FatalError(`Required fenced persistence requires reconciliation: ${kind}`);
  }
}
