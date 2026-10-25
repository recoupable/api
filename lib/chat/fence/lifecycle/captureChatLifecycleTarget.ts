import { encodeStrictJson } from "../encodeStrictJson";
import { chatLifecycleTargetSchema, type ChatLifecycleTarget } from "./chatLifecycleTargetSchema";
/** Flat immutable copy: never replace the original epoch, owner or run with a later observation. */
export function captureChatLifecycleTarget(input: ChatLifecycleTarget): ChatLifecycleTarget {
  encodeStrictJson(input);
  return Object.freeze(chatLifecycleTargetSchema.parse(input));
}
