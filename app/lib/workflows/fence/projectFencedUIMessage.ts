import type { UIMessage } from "ai";
import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";

/** SDK optional object fields are absent in durable JSON; all other strict checks remain intact. */
export function projectFencedUIMessage(message: UIMessage): UIMessage {
  return JSON.parse(encodeStrictJson(message, { omitUndefinedObjectProperties: true }));
}
