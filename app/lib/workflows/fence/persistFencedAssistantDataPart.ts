import type { UIMessage } from "ai";
import type { ChatFenceWriter } from "@/lib/chat/fence/chatFenceSchemas";
import { upsertAssistantDataPart } from "@/lib/chat/upsertAssistantDataPart";
import { persistFencedMessageStep } from "./persistFencedMessageStep";

/** Pure merge followed by the separately journaled required update; never repeats the commit step. */
export async function persistFencedAssistantDataPart(
  writer: ChatFenceWriter,
  message: UIMessage,
  part: { type: string; id: string; data: unknown },
) {
  await persistFencedMessageStep(writer, "update_parts", upsertAssistantDataPart(message, part));
}
