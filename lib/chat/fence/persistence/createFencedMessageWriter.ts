import type { UIMessage } from "ai";
import type { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import {
  chatFenceWriterSchema,
  chatFenceCommandSchema,
  type ChatFenceWriter,
} from "../chatFenceSchemas";
import { encodeStrictJson } from "../encodeStrictJson";
import { FencedPersistenceError } from "./FencedPersistenceError";

/** Disabled adapter. Capture only the admitted authority and actual bound run; never fetch current state. */
export function createFencedMessageWriter(
  input: ChatFenceWriter,
  execute: typeof executeChatFenceCommand,
) {
  encodeStrictJson(input);
  const writer = Object.freeze(chatFenceWriterSchema.parse(input));
  const token = { epoch: writer.epoch, owner: writer.owner, run_id: writer.runId };
  async function required(commandInput: unknown) {
    let command;
    try {
      encodeStrictJson(commandInput);
      command = chatFenceCommandSchema.parse(commandInput);
    } catch {
      throw new FencedPersistenceError("invalid_command");
    }
    let result;
    try {
      result = await execute(writer.chatId, writer.effectiveAccount, command);
    } catch {
      throw new FencedPersistenceError("transport_ambiguous");
    }
    if (result.ok === false)
      throw new FencedPersistenceError(result.error.kind, result.error.retrySameCommand);
    if (result.action !== command.action) throw new FencedPersistenceError("invalid_receipt");
    return result;
  }
  async function write(
    message: UIMessage,
    role: "user" | "assistant",
    mode: "insert" | "upsert",
  ): Promise<{ written: true; outcome: "inserted" | "exactDuplicate" | "updated" }> {
    try {
      encodeStrictJson(message);
    } catch {
      throw new FencedPersistenceError("invalid_command");
    }
    const result = await required({
      action: "write",
      payload: { ...token, id: message?.id, role, mode, parts: message },
    });
    if (result.action !== "write") throw new FencedPersistenceError("invalid_receipt");
    return { written: true, outcome: result.value.outcome };
  }
  return Object.freeze({
    async insertUser(
      message: UIMessage,
    ): Promise<{ written: true; outcome: "inserted" | "exactDuplicate" }> {
      const result = await write(message, "user", "insert");
      if (result.outcome === "updated") throw new FencedPersistenceError("invalid_receipt");
      return { written: true as const, outcome: result.outcome };
    },
    upsertAssistant: (message: UIMessage) => write(message, "assistant", "upsert"),
    async updateAssistantParts(message: UIMessage): Promise<{ updated: true }> {
      try {
        encodeStrictJson(message);
      } catch {
        throw new FencedPersistenceError("invalid_command");
      }
      if (message?.role !== "assistant") throw new FencedPersistenceError("invalid_command");
      const result = await required({
        action: "update_parts",
        payload: { ...token, id: message?.id, parts: message },
      });
      if (result.action !== "update_parts") throw new FencedPersistenceError("invalid_receipt");
      if (!result.value.updated) throw new FencedPersistenceError("missing_message");
      return { updated: true };
    },
  });
}
export type FencedMessageWriter = ReturnType<typeof createFencedMessageWriter>;
