import { chatFenceAuthoritySchema, type ChatFenceAuthority } from "./chatFenceSchemas";

/** Capture once from authenticated admission; never refresh old work to current authority. */
export function createChatFenceAuthority(input: unknown): ChatFenceAuthority {
  return Object.freeze(chatFenceAuthoritySchema.parse(input));
}
