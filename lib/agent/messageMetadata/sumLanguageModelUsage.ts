import type { LanguageModelUsage } from "ai";
import { addLanguageModelUsage } from "@/lib/agent/messageMetadata/addLanguageModelUsage";

/**
 * Sum two optional `LanguageModelUsage` records. Returns the sum when
 * both are defined, the defined one when only one is, or `undefined`
 * when neither is. Mirrors open-agents' `sumLanguageModelUsage` in
 * `packages/agent/usage.ts`.
 *
 * Used by the `task` tool's progress streaming to accumulate usage
 * across subagent steps without introducing zero-tokens placeholders
 * before the first step finishes.
 */
export function sumLanguageModelUsage(
  a: LanguageModelUsage | undefined,
  b: LanguageModelUsage | undefined,
): LanguageModelUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  return addLanguageModelUsage(a, b);
}
