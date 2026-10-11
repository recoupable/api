import { safeValidateUIMessages } from "ai";
import { generateUUID } from "@/lib/uuid/generateUUID";

/** Preserve every SDK part before provisioning; a prompt becomes one user message. */
export async function validateChatRunMessages(prompt: string, messages?: unknown[]) {
  return safeValidateUIMessages({
    messages: prompt
      ? [{ id: generateUUID(), role: "user", parts: [{ type: "text", text: prompt }] }]
      : messages,
  });
}
